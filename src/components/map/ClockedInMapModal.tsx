/**
 * "Where everyone is" — the clocked-in map (v2.3756, punch list #31), opened
 * from the Map button in the Currently In bar. The strip mounts it once, so
 * the Dashboard, People → Hours and Quickfill all get it.
 *
 * The map on the left, the stops on the right: the same list read two ways.
 * A pin is a job or bid with someone clocked on it, its badge the head count;
 * the office sessions sit on the office anchor diamond; a person with no job
 * is named under the list with the strip's own Assign door, never guessed
 * onto the map. Live from the strip's `sessions` prop (it ticks and refreshes
 * over realtime) — no new query, no new subscription. Google Maps when the
 * browser key loads, OpenStreetMap otherwise (the same one-way fallback as
 * the jobs map). On a phone: a full-screen sheet, the selected stop as a bar
 * under the map with two 44 px buttons, the rest listed beneath.
 *
 * v2.3764: a "Travel times" button routes each placed stop to the office on
 * demand (`clockedInMapTravel.ts` → the `driving-distance` edge function),
 * and the rail, popup and phone bar then read "20 mi · 32 min to the office";
 * a stop the router will not answer reads the ≈ estimate instead.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ClockSessionRow, DashboardStripSession } from '../../types/clockSessions'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { useAddressGeocodeCoords } from '../../hooks/useAddressGeocodeCoords'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { useOverheadOfficeJobId } from '../../hooks/useOverheadOfficeJobId'
import { useIsMobile } from '../../hooks/useIsMobile'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { normalizeAddressForGeocodeKey } from '../../lib/map/normalizeAddressForGeocode'
import type { MapCanvasAnchor } from '../../lib/map/mapCanvasTypes'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import {
  buildClockedInMap,
  CLOCKED_IN_MAP_COLOR,
  clockedInMapAddresses,
  clockedInMapBidHref,
  clockedInMapDirectionsUrl,
  clockedInMapDistanceLabel,
  clockedInMapHeaderStamp,
  clockedInMapSummaryLine,
  clockedInMapUnmappedLine,
  placeClockedInStops,
  type ClockedInPerson,
  type ClockedInStop,
} from '../../lib/clockedInMap'
import { AssignSessionJobPopover, type AssignSessionJobSavedPatch } from '../clock-sessions/AssignSessionJobPopover'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import type { DrivingDistanceResponse } from '../../lib/bidDistanceToOffice'
import { computeTravelForStops, formatTravelLine, travelSummaryLine, type StopTravel, type TravelInvoke, type TravelStopInput } from '../../lib/clockedInMapTravel'

const PinsMapCanvas = lazy(() => import('./PinsMapCanvas'))
const PinsMapGoogleCanvas = lazy(() => import('./PinsMapGoogleCanvas'))

/** Above the strip's popovers (1100) and the Bids modals (1000); the Assign door opens above this. */
export const CLOCKED_IN_MAP_Z = 1200
const ASSIGN_POPOVER_Z = CLOCKED_IN_MAP_Z + 50
/** One ring, the office's near radius — the everything-view with both rings is the Bid Board's. */
const OFFICE_RING_MILES: readonly number[] = [25]

const TIME_OPTS: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

const OUTLINE_BUTTON: CSSProperties = {
  padding: '0.3rem 0.7rem',
  fontSize: '0.8125rem',
  background: 'none',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
}
const POPUP_BUTTON: CSSProperties = { ...OUTLINE_BUTTON, flex: 1, background: 'var(--surface)' }
const MOBILE_ACTION: CSSProperties = {
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
const LINK_BUTTON: CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  font: 'inherit',
  color: 'var(--text-link)',
  cursor: 'pointer',
}
const RAIL_HEAD: CSSProperties = {
  padding: '0.45rem 0.75rem',
  fontSize: '0.68rem',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-faint)',
  fontWeight: 700,
  borderBottom: '1px solid var(--border)',
}

function formatSince(iso: string): string {
  const d = new Date(iso)
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString(undefined, TIME_OPTS) : '—'
}

function CountDot({ kind, count, size = 20 }: { kind: ClockedInStop['kind']; count: number | null; size?: number }) {
  if (kind === 'office') {
    return (
      <span
        aria-hidden
        style={{ width: size * 0.62, height: size * 0.62, margin: size * 0.19, background: CLOCKED_IN_MAP_COLOR.office, transform: 'rotate(45deg)', display: 'inline-block', flex: 'none', boxSizing: 'border-box', border: '2px solid var(--surface)', boxShadow: `0 0 0 1px ${CLOCKED_IN_MAP_COLOR.office}` }}
      />
    )
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, borderRadius: '50%', background: CLOCKED_IN_MAP_COLOR[kind], color: '#fff', fontSize: 10, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}
    >
      {count ?? ''}
    </span>
  )
}

/** `Abraham 3h 45m · Paige 4h 27m` — the rail's who line. */
function WhoLine({ people }: { people: readonly ClockedInPerson[] }) {
  return (
    <div style={{ fontSize: '0.78rem', color: 'var(--text-base)', marginTop: 2, lineHeight: 1.4 }}>
      {people.map((p, i) => (
        <span key={p.sessionId}>
          {i > 0 ? ' · ' : ''}
          <b style={{ fontWeight: 600 }}>{p.name}</b> {p.elapsedLabel}
        </span>
      ))}
    </div>
  )
}

/** One line per person: name, since · elapsed, memo — the popup and the phone bar. */
function PeopleLines({ people, compact }: { people: readonly ClockedInPerson[]; compact?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {people.map((p) => (
        <div key={p.sessionId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: compact ? '2px 0' : '3px 0', borderTop: compact ? 'none' : '1px solid var(--border)', fontSize: '0.8125rem' }}>
          <span style={{ minWidth: 0 }}>
            <b style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{p.name}</b>
            <span style={{ color: 'var(--text-muted)', display: compact ? 'inline' : 'block', fontSize: compact ? undefined : '0.75rem' }}>
              {compact ? ' ' : ''}since {formatSince(p.clockedInAt)} · {p.elapsedLabel}
            </span>
          </span>
          {p.memo ? <span style={{ color: 'var(--text-muted)', textAlign: 'right', maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.memo}>{p.memo}</span> : null}
        </div>
      ))}
    </div>
  )
}

function StopActions({ stop, onOpen, onDirections, style }: { stop: ClockedInStop; onOpen: (s: ClockedInStop) => void; onDirections: (s: ClockedInStop) => void; style: CSSProperties }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
      <button type="button" onClick={() => onOpen(stop)} style={style}>
        {stop.kind === 'bid' ? 'Open bid' : 'Open job'}
      </button>
      {stop.address ? (
        <button type="button" onClick={() => onDirections(stop)} style={style}>
          Directions
        </button>
      ) : null}
    </div>
  )
}

export type ClockedInMapModalProps = {
  sessions: readonly DashboardStripSession[]
  prefixMap: LedgerPrefixMap
  /** The strip's tick — the header time and every elapsed figure follow it. */
  nowMs: number
  onClose: () => void
  /** The strip's own opener (tabbed window for the office, read-only pane for superintendents). */
  onOpenJob: (jobLedgerId: string, jl: ClockSessionRow['jobs_ledger'] | null) => void
  onJobBidSaved?: (patch: AssignSessionJobSavedPatch) => void
  onJobBidAssignError?: (msg: string) => void
  /** The strip's work date, for the Assign door's Dispatch quick-picks. */
  workDateYmd?: string
}

export default function ClockedInMapModal({ sessions, prefixMap, nowMs, onClose, onOpenJob, onJobBidSaved, onJobBidAssignError, workDateYmd }: ClockedInMapModalProps) {
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const anchor = useOfficeAnchor(true)
  const officeJobId = useOverheadOfficeJobId(true)
  const officeAddressKey = anchor && anchor.source === 'office_address' ? normalizeAddressForGeocodeKey(anchor.label) : null

  const model = useMemo(
    () => buildClockedInMap(sessions, nowMs, prefixMap, { officeJobLedgerId: officeJobId, officeAddressKey }),
    [sessions, nowMs, prefixMap, officeJobId, officeAddressKey],
  )
  const addresses = useMemo(() => clockedInMapAddresses(model), [model])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, true, 'clocked-in map address_geocodes')
  const placed = useMemo(() => placeClockedInStops(model.stops, coords), [model.stops, coords])
  const stopById = useMemo(() => new Map(model.stops.map((s) => [s.id, s])), [model.stops])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  // v2.3764: drive to the office per stop, on demand.
  const [travel, setTravel] = useState<Map<string, StopTravel>>(() => new Map())
  const [travelBusy, setTravelBusy] = useState(false)
  const [googleFailed, setGoogleFailed] = useState(false)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const googleUnavailable = useCallback((reason: string) => {
    console.warn(`[clocked-in map] Google Maps unavailable, using OpenStreetMap — ${reason}`)
    setGoogleFailed(true)
  }, [])

  useEffect(() => {
    if (selectedId && !placed.pins.some((p) => p.id === selectedId)) setSelectedId(null)
  }, [placed.pins, selectedId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // The Assign door is its own dialog on top of this one — its Escape closes it, not the map.
      // Capture phase: the popover closes itself from a document listener and React flushes that
      // at the microtask checkpoint right after, so a bubble listener here would already see it gone.
      if (document.querySelector('[role="dialog"][aria-label="Assign job or bid"]')) return
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const openStop = useCallback(
    (s: ClockedInStop) => {
      if (s.jobLedgerId) onOpenJob(s.jobLedgerId, s.jobsLedger)
      else if (s.bidId) navigate(clockedInMapBidHref(s.bidId))
      onClose()
    },
    [onOpenJob, navigate, onClose],
  )
  const directions = useCallback((s: ClockedInStop) => openInExternalBrowser(clockedInMapDirectionsUrl(s.address)), [])

  const canvasAnchor = useMemo<MapCanvasAnchor | null>(
    () => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: 'Office', ringMiles: OFFICE_RING_MILES } : null),
    [anchor],
  )
  const distanceFor = useCallback((s: ClockedInStop) => clockedInMapDistanceLabel(placed.coordsByStop.get(s.id), anchor), [placed.coordsByStop, anchor])
  /** The routed (or estimated) line once Travel times ran; the straight-line miles before. */
  const travelLineFor = useCallback(
    (s: ClockedInStop) => {
      const t = travel.get(s.id)
      return t ? formatTravelLine(t) : distanceFor(s)
    },
    [travel, distanceFor],
  )
  const travelStops = useMemo<TravelStopInput[]>(
    () => model.stops.flatMap((s) => {
      const c = placed.coordsByStop.get(s.id)
      return c ? [{ id: s.id, addressKey: s.addressKey, coords: c }] : []
    }),
    [model.stops, placed.coordsByStop],
  )
  const travelStale = travelStops.some((s) => !travel.has(s.id))
  const travelInvoke = useCallback<TravelInvoke>(
    (body) =>
      withSupabaseRetry<DrivingDistanceResponse>(
        async () => supabase.functions.invoke<DrivingDistanceResponse>('driving-distance', { body }),
        'driving-distance clocked-in map',
      ),
    [],
  )
  const computeTravel = useCallback(async () => {
    if (!anchor || travelStops.length === 0 || travelBusy) return
    setTravelBusy(true)
    try {
      // A bare point: the function reads lat/lng, and the memo key is the office's position.
      const res = await computeTravelForStops(travelStops, { lat: anchor.lat, lng: anchor.lng }, travelInvoke)
      setTravel((prev) => {
        const next = new Map(prev)
        for (const [k, v] of res) next.set(k, v)
        return next
      })
    } finally {
      setTravelBusy(false)
    }
  }, [anchor, travelStops, travelBusy, travelInvoke])
  const travelButton =
    anchor && travelStops.length > 0 ? (
      <button
        type="button"
        onClick={() => void computeTravel()}
        disabled={travelBusy || !travelStale}
        title={travelStale ? 'Route each stop to the office: driven miles and minutes (one lookup per stop)' : 'Every stop on the map has its drive to the office'}
        style={{ ...OUTLINE_BUTTON, opacity: travelBusy || !travelStale ? 0.6 : 1, cursor: travelBusy || !travelStale ? 'default' : 'pointer', minHeight: isMobile ? 36 : undefined }}
      >
        {travelBusy ? 'Routing…' : travelStale ? 'Travel times' : 'Travel times ✓'}
      </button>
    ) : null

  const renderPopup = useCallback(
    (id: string): ReactNode => {
      const s = stopById.get(id)
      if (!s) return null
      const distance = travelLineFor(s)
      return (
        <div style={{ fontSize: '0.8125rem', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 230, maxWidth: 300, color: 'var(--text-base)', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{s.label}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            {formatAddressWithoutZip(s.address) || 'No address on file'}
            {distance ? ` · ${distance}` : ''}
          </div>
          <PeopleLines people={s.people} />
          <StopActions stop={s} onOpen={openStop} onDirections={directions} style={POPUP_BUTTON} />
        </div>
      )
    },
    [stopById, travelLineFor, openStop, directions],
  )

  const selected = selectedId ? (stopById.get(selectedId) ?? null) : null
  const unmappedAll = [...placed.unmapped, ...placed.noAddress]
  const unmappedLine = clockedInMapUnmappedLine(unmappedAll)
  const mapHeight = isMobile ? 240 : 460
  const stamp = clockedInMapHeaderStamp(nowMs)
  const legend = model.legend

  const stopRow = (s: ClockedInStop) => {
    const isSelected = s.id === selectedId
    const placedHere = placed.coordsByStop.has(s.id)
    const distance = travelLineFor(s)
    return (
      <button
        key={s.id}
        type="button"
        onClick={() => setSelectedId(isSelected ? null : s.id)}
        aria-pressed={isSelected}
        title={placedHere ? 'Select this stop on the map' : 'Not on the map yet — no location for this address'}
        style={{
          display: 'flex',
          gap: 9,
          alignItems: 'flex-start',
          width: '100%',
          textAlign: 'left',
          padding: '0.5rem 0.75rem',
          border: 'none',
          borderBottom: '1px solid var(--border)',
          background: isSelected ? 'var(--bg-blue-tint)' : 'transparent',
          boxShadow: isSelected ? 'inset 3px 0 0 var(--border-blue)' : 'none',
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
          minHeight: isMobile ? 44 : undefined,
          opacity: placedHere ? 1 : 0.8,
        }}
      >
        <CountDot kind={s.kind} count={s.people.length} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem' }}>{s.label}</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatAddressWithoutZip(s.address) || 'No address on file'}
            {distance ? ` · ${distance}` : placedHere ? '' : s.address ? ' · not placed yet' : ''}
          </span>
          <WhoLine people={s.people} />
        </span>
      </button>
    )
  }

  const officeRow = model.office ? (
    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
      <CountDot kind="office" count={null} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem' }}>Office</span>
        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatAddressWithoutZip(anchor?.source === 'office_address' ? anchor.label : model.office.address) || 'On the office diamond'}</span>
        <WhoLine people={model.office.people} />
      </span>
    </div>
  ) : null

  const unassignedRow =
    model.unassigned.length > 0 ? (
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
        <span aria-hidden style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px dashed var(--text-muted)', flex: 'none', boxSizing: 'border-box' }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.875rem' }}>Not on a job</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Named here, never guessed onto the map.</span>
          {model.unassigned.map((p) => (
            <div key={p.sessionId} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.78rem', marginTop: 4, lineHeight: 1.4 }}>
              <span>
                <b style={{ fontWeight: 600 }}>{p.name}</b> {p.elapsedLabel}
                {p.memo ? <span style={{ color: 'var(--text-muted)' }}> · {p.memo}</span> : null}
              </span>
              {p.synthetic ? (
                <span style={{ color: 'var(--text-muted)' }}>· Salary schedule</span>
              ) : (
                <AssignSessionJobPopover
                  session={p.session as ClockSessionRow}
                  onSaved={(patch) => {
                    if (patch) onJobBidSaved?.(patch)
                  }}
                  onError={onJobBidAssignError}
                  popoverZIndex={ASSIGN_POPOVER_Z}
                  unassignedTrigger="default"
                  compactTrigger
                  dispatchScheduleAssigneeUserId={p.userId}
                  dispatchScheduleWorkDateYmd={workDateYmd ?? p.session.work_date}
                />
              )}
            </div>
          ))}
        </span>
      </div>
    ) : null

  const legendNode = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: CLOCKED_IN_MAP_COLOR.job, display: 'inline-block' }} />
        {legend.jobs} {legend.jobs === 1 ? 'job' : 'jobs'}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: CLOCKED_IN_MAP_COLOR.bid, display: 'inline-block' }} />
        {legend.bids} {legend.bids === 1 ? 'bid' : 'bids'}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
        <span aria-hidden style={{ width: 8, height: 8, background: CLOCKED_IN_MAP_COLOR.office, transform: 'rotate(45deg)', display: 'inline-block' }} />
        office {legend.office}
      </span>
    </div>
  )

  const mapNode = (
    <div style={{ position: 'relative', height: mapHeight, overflow: 'hidden', isolation: 'isolate', background: 'var(--bg-muted)' }}>
      {placed.pins.length > 0 || canvasAnchor ? (
        <Suspense fallback={<div style={{ padding: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading map…</div>}>
          {provider === 'google' ? (
            <PinsMapGoogleCanvas
              apiKey={googleMapsBrowserKey()}
              onUnavailable={googleUnavailable}
              pins={placed.pins}
              selectedId={selectedId}
              onSelect={setSelectedId}
              renderPopup={renderPopup}
              fitSignal={fitSignal}
              height={mapHeight}
              isMobile={isMobile}
              anchor={canvasAnchor}
            />
          ) : (
            <PinsMapCanvas pins={placed.pins} selectedId={selectedId} onSelect={setSelectedId} renderPopup={renderPopup} fitSignal={fitSignal} height={mapHeight} isMobile={isMobile} anchor={canvasAnchor} />
          )}
        </Suspense>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {resolving ? 'Finding the jobs on the map…' : model.stops.length > 0 ? 'None of these jobs has a map location yet.' : 'Nobody is clocked on a job right now.'}
        </div>
      )}
      {placed.pins.length === 0 && canvasAnchor && model.stops.length === 0 ? (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--surface)', borderTop: '1px solid var(--border)', zIndex: 1 }}>
          Nobody is clocked on a job right now.
        </div>
      ) : null}
    </div>
  )

  const footerNode = (
    <div style={{ display: 'flex', gap: '0.5rem 1rem', flexWrap: 'wrap', alignItems: 'baseline', padding: '0.5rem 0.9rem', borderTop: '1px solid var(--border)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
      {!isMobile ? <span>Moves as people clock in and out · the strip’s own feed</span> : null}
      {travelSummaryLine(travel) ? <span>{travelSummaryLine(travel)}</span> : null}
      {unmappedLine ? (
        <span>
          {unmappedLine}
          {unmappedAll.length <= 3
            ? unmappedAll.map((s) => (
                <span key={s.id}>
                  {' · '}
                  <button type="button" onClick={() => openStop(s)} style={{ ...LINK_BUTTON, fontSize: 'inherit' }}>
                    {s.label}
                  </button>
                </span>
              ))
            : null}
        </span>
      ) : resolving && model.stops.length > 0 ? (
        <span>Placing the rest…</span>
      ) : null}
      <span style={{ marginLeft: 'auto' }}>
        <Link to="/map" onClick={onClose} style={{ color: 'var(--text-link)' }}>
          Open the full map ›
        </Link>
      </span>
    </div>
  )

  const card: CSSProperties = isMobile
    ? { background: 'var(--surface)', width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden' }
    : { background: 'var(--surface)', borderRadius: 10, width: 'min(1100px, calc(100vw - 2rem))', maxHeight: 'calc(100dvh - 2rem - var(--app-bottom-chrome, 0px))', display: 'grid', gridTemplateRows: 'auto 1fr auto', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Where everyone is"
      // Ends above the Dispatch / Job mode footer (--app-bottom-chrome) so the sheet's buttons are never under the bar.
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--app-bottom-chrome, 0px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: CLOCKED_IN_MAP_Z, padding: isMobile ? 0 : '1rem' }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem 0.75rem', flexWrap: isMobile ? 'nowrap' : 'wrap', padding: isMobile ? '0.5rem 0.5rem 0.5rem 0.75rem' : '0.7rem 0.9rem', borderBottom: '1px solid var(--border)' }}>
          {/* On a phone the title and the stamp stack so the × never wraps to a second line. */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? 1 : '0.75rem', minWidth: 0, flex: isMobile ? 1 : undefined }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? '1rem' : '1.05rem', color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>Where everyone is</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }} aria-live="polite">
              {stamp} · live
            </span>
          </div>
          {!isMobile ? <span style={{ flex: 1 }} /> : null}
          {!isMobile ? legendNode : null}
          {!isMobile ? travelButton : null}
          {!isMobile && placed.pins.length + (canvasAnchor ? 1 : 0) > 1 ? (
            <button type="button" onClick={() => setFitSignal((n) => n + 1)} style={OUTLINE_BUTTON} title="Frame every stop and the office">
              Fit all
            </button>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', lineHeight: 1, color: 'var(--text-muted)', padding: isMobile ? '0.5rem 0.6rem' : 4, minHeight: isMobile ? 44 : undefined }}>
            ×
          </button>
        </div>

        {isMobile ? (
          <div style={{ overflowY: 'auto', minHeight: 0 }}>
            <div style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span>{clockedInMapSummaryLine(model)}</span>
              {travelButton}
            </div>
            {mapNode}
            {selected ? (
              <div style={{ background: 'var(--bg-blue-tint)', borderTop: '2px solid var(--border-blue)', padding: '0.5rem 0.75rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.9375rem' }}>
                  {selected.label}
                  {travelLineFor(selected) ? <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}> · {travelLineFor(selected)}</span> : null}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{formatAddressWithoutZip(selected.address)}</div>
                <PeopleLines people={selected.people} compact />
                <StopActions stop={selected} onOpen={openStop} onDirections={directions} style={MOBILE_ACTION} />
              </div>
            ) : null}
            {model.stops.filter((s) => s.id !== selectedId).map(stopRow)}
            {officeRow}
            {unassignedRow}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', minHeight: 0 }}>
            {mapNode}
            <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: mapHeight }}>
              <div style={RAIL_HEAD}>
                {model.stops.length} {model.stops.length === 1 ? 'stop' : 'stops'} · {model.peopleCount} {model.peopleCount === 1 ? 'person' : 'people'}
              </div>
              <div style={{ overflowY: 'auto', minHeight: 0 }}>
                {model.stops.map(stopRow)}
                {officeRow}
                {unassignedRow}
              </div>
            </div>
          </div>
        )}

        {footerNode}
      </div>
    </div>
  )
}
