/**
 * Bid Board "Bids on a map" card (v2.3162) — every Bid Board viewer.
 *
 * Plots the bids the board is showing: the same filtered rows (search, trade
 * pill, My bids), one pin per bid with an address, colored by board section.
 * Mounts between the section pills and the first section; renders nothing when
 * there is no bid to show. Collapsible: **Hide map** (or the title itself) keeps the header line and
 * remembers the choice per device; the board's **Map** pill reveals it again.
 *
 * Interactions: a pin selects the bid — its popup (desktop) / bar (phone)
 * carries Open bid (the preview modal), Edit (Edit Bid) and Directions — and
 * lights the bid's row on the board below (`onFocusRow`). The legend chips
 * toggle sections on the map only, never on the board. **Play** (v2.3208)
 * tours the section views — one section alone for two seconds each, that
 * chip lit — and **Pause** holds the view that is up. The office anchor and
 * its 25 / 50 mile rings come from the same setting the bid form's Distance
 * to Office auto-fill uses (`resolveOfficeAnchor`). Google Maps when a
 * browser key is configured and loads, OpenStreetMap otherwise — the
 * Dashboard card's provider rule.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { useAddressGeocodeCoords, type AddressToGeocode } from '../../hooks/useAddressGeocodeCoords'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { supabase } from '../../lib/supabase'
import { withSupabaseRetry } from '../../utils/errorHandling'
import { useToastContext } from '../../contexts/ToastContext'
import { computeBidDistanceToOffice } from '../../lib/bidDistanceToOffice'
import { bidUpdateRefused, BID_UPDATE_NOT_APPLIED_MESSAGE } from '../../lib/bids/updateGuard'
import { composeMissingAddressRows } from '../../lib/bids/bidBoardMissingAddresses'
import { BidBoardMissingAddressesModal } from './BidBoardMissingAddressesModal'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import {
  BID_BOARD_MAP_DEFAULT_SECTIONS,
  BID_BOARD_MAP_DUE_RING_COLOR,
  BID_BOARD_MAP_RING_MILES,
  BID_BOARD_MAP_SECTION_COLOR,
  BID_BOARD_MAP_SECTION_LABEL,
  BID_BOARD_MAP_TOUR_INTERVAL_MS,
  bidBoardMapBids,
  bidBoardMapDirectionsUrl,
  bidBoardMapDistanceLine,
  bidBoardMapHomeFitPoints,
  bidBoardMapLegend,
  bidBoardMapTourNext,
  bidBoardMapTourStops,
  bidBoardMapTourVisibility,
  bidBoardMapUnmappedLine,
  bidBoardMapVisiblePins,
  readBidBoardMapHidden,
  resolveBidBoardMapPins,
  writeBidBoardMapHidden,
  type BidBoardMapDueTone,
  type BidBoardMapPin,
  type BidBoardMapSectionVisibility,
  type BidBoardMapBid,
} from '../../lib/bids/bidBoardMap'
import type { SubmissionSectionKey } from '../../lib/bids/submissionSections'
import type { MapCanvasAnchor, MapCanvasPin } from '../../lib/map/mapCanvasTypes'

const PinsMapCanvas = lazy(() => import('../map/PinsMapCanvas'))
const PinsMapGoogleCanvas = lazy(() => import('../map/PinsMapGoogleCanvas'))

const OUTLINE_BUTTON_STYLE: React.CSSProperties = {
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'none',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

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

function PinGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  )
}

function PlayGlyph({ playing }: { playing: boolean }) {
  return playing ? (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="4" width="5" height="16" rx="1" />
      <rect x="14" y="4" width="5" height="16" rx="1" />
    </svg>
  ) : (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
    </svg>
  )
}

function SectionChip({ section }: { section: SubmissionSectionKey }) {
  const c = BID_BOARD_MAP_SECTION_COLOR[section]
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: c, border: `1px solid ${c}`, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' }}>
      {BID_BOARD_MAP_SECTION_LABEL[section]}
    </span>
  )
}

const DUE_CHIP_STYLE: Record<BidBoardMapDueTone | 'normal', React.CSSProperties> = {
  overdue: { color: 'var(--text-red-700)', border: '1px solid #dc2626', background: 'var(--bg-red-tint)' },
  soon: { color: 'var(--text-amber-700)', border: '1px solid #d97706', background: 'var(--bg-amber-tint)' },
  normal: { color: 'var(--text-muted)', border: '1px solid var(--border)', background: 'transparent' },
}

function DueChip({ label, tone }: { label: string; tone: BidBoardMapDueTone | null }) {
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap', ...DUE_CHIP_STYLE[tone ?? 'normal'] }} title="Due date">
      {label}
    </span>
  )
}

/** The popup / info-window body: the board row, compressed. */
function BidPinBody({
  pin,
  onOpenBid,
  onEditBid,
  onDirections,
}: {
  pin: BidBoardMapPin
  onOpenBid: ((bid: BidWithBuilder) => void) | null
  onEditBid: (bid: BidWithBuilder) => void
  onDirections: (pin: BidBoardMapPin) => void
}) {
  const distance = bidBoardMapDistanceLine(pin)
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
      {pin.gcName ? <div style={{ color: 'var(--text-muted)' }}>{pin.gcName}</div> : null}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <SectionChip section={pin.section} />
        {pin.dueLabel ? <DueChip label={pin.dueLabel} tone={pin.dueTone} /> : null}
        {pin.estimatorName ? <span style={{ color: 'var(--text-muted)' }}>{pin.estimatorName}</span> : null}
      </div>
      <div style={{ color: 'var(--text-muted)' }}>
        {formatAddressWithoutZip(pin.address)}
        {distance ? ` · ${distance}` : ''}
      </div>
      {pin.valueLabel ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Bid value {pin.valueLabel}</div> : null}
      <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
        {onOpenBid ? (
          <button type="button" onClick={() => onOpenBid(pin.row)} style={POPUP_BUTTON_STYLE}>
            Open bid
          </button>
        ) : null}
        <button type="button" onClick={() => onEditBid(pin.row)} style={POPUP_BUTTON_STYLE}>
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
  lit,
  onToggle,
  isMobile,
}: {
  legend: { section: SubmissionSectionKey; count: number }[]
  show: BidBoardMapSectionVisibility
  /** The tour's current view — that chip fills with its section color and a two-second underline runs across it. */
  lit: SubmissionSectionKey | null
  onToggle: (section: SubmissionSectionKey) => void
  isMobile: boolean
}) {
  // The phone row scrolls sideways — bring the lit chip into view at each stop so the tour is never running off-screen.
  const litRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (!lit || !isMobile) return
    litRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [lit, isMobile])
  return (
    <div
      role="group"
      aria-label="Sections on the map"
      style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', overflowX: isMobile ? 'auto' : undefined, WebkitOverflowScrolling: 'touch', flexWrap: isMobile ? 'nowrap' : 'wrap' }}
    >
      {legend.map((l) => {
        const on = show[l.section]
        const c = BID_BOARD_MAP_SECTION_COLOR[l.section]
        const isLit = lit === l.section
        return (
          <button
            key={l.section}
            ref={isLit ? litRef : undefined}
            type="button"
            onClick={() => onToggle(l.section)}
            aria-pressed={on}
            aria-current={isLit ? 'true' : undefined}
            data-tour-lit={isLit ? 'true' : undefined}
            title={on ? `Hide ${BID_BOARD_MAP_SECTION_LABEL[l.section]} pins` : `Show ${BID_BOARD_MAP_SECTION_LABEL[l.section]} pins`}
            style={{
              flex: '0 0 auto',
              position: 'relative',
              overflow: 'hidden',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: isMobile ? '0.3rem 0.6rem' : '0.15rem 0.6rem',
              minHeight: isMobile ? 36 : undefined,
              border: `1px solid ${isLit ? c : 'var(--border-strong)'}`,
              borderRadius: 999,
              background: isLit ? c : 'var(--surface)',
              color: isLit ? 'white' : 'var(--text-700)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              opacity: on ? 1 : 0.45,
              fontFamily: 'inherit',
              transition: 'background 150ms, color 150ms, border-color 150ms',
            }}
          >
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, background: isLit ? 'white' : on ? c : 'var(--text-faint-300)', display: 'inline-block' }} />
            {BID_BOARD_MAP_SECTION_LABEL[l.section]}
            <span style={{ fontWeight: 500, color: isLit ? 'rgba(255,255,255,0.85)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{l.count}</span>
            {isLit ? (
              // keyed on the section so the underline restarts from zero at every stop
              <span key={l.section} aria-hidden className="bid-board-map-tour-fill" style={{ animationDuration: `${BID_BOARD_MAP_TOUR_INTERVAL_MS}ms` }} />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function BidBoardMapCard({
  bids,
  ledgerPrefixMap,
  isMobile,
  loading,
  onOpenBid,
  onEditBid,
  onFocusRow,
  revealSignal,
  onReloadBids,
}: {
  /** The board's filtered rows — the map follows the search and the trade pill. */
  bids: readonly BidWithBuilder[]
  ledgerPrefixMap: LedgerPrefixMap
  isMobile: boolean
  loading: boolean
  /** The bid preview modal opener; null when the page has no preview context (the button is dropped). */
  onOpenBid: ((bid: BidWithBuilder) => void) | null
  onEditBid: (bid: BidWithBuilder) => void
  /** A pin (or an unmapped-bid link) was clicked — light the row on the board. */
  onFocusRow: (bidId: string) => void
  /** Bumped by the board's Map pill: un-hides the card. */
  revealSignal: number
  /** After an address is saved from the "no map location" sheet — the board re-reads its rows. */
  onReloadBids: () => void
}) {
  const { showToast } = useToastContext()
  const [hidden, setHidden] = useState<boolean>(() => readBidBoardMapHidden())
  useEffect(() => {
    if (revealSignal > 0) {
      setHidden(false)
      writeBidBoardMapHidden(false)
    }
  }, [revealSignal])
  const [show, setShow] = useState<BidBoardMapSectionVisibility>(() => ({ ...BID_BOARD_MAP_DEFAULT_SECTIONS }))
  // The section tour (v2.3208): the view that is up while Play runs; null when paused / never started.
  const [tour, setTour] = useState<SubmissionSectionKey | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fitSignal, setFitSignal] = useState(0)
  // The map opens on the office's region (pins within BID_BOARD_MAP_HOME_FIT_MILES); Fit all widens to every pin.
  const [fitAll, setFitAll] = useState(false)
  // Google Maps when a browser key is configured and the API loads; OpenStreetMap otherwise.
  // A failure is sticky for this page so a bad key never flickers (v2.3145).
  const [googleFailed, setGoogleFailed] = useState(false)
  const provider = resolveDashboardMapProvider({ key: googleMapsBrowserKey(), googleFailed })
  const googleUnavailable = useCallback((reason: string) => {
    console.warn(`[bids map] Google Maps unavailable, using OpenStreetMap — ${reason}`)
    setGoogleFailed(true)
  }, [])

  const anchor = useOfficeAnchor(!hidden)
  const canvasAnchor = useMemo<MapCanvasAnchor | null>(
    () => (anchor ? { lat: anchor.lat, lng: anchor.lng, label: 'Office', ringMiles: BID_BOARD_MAP_RING_MILES } : null),
    [anchor],
  )

  const { bids: mapBids, noAddress } = useMemo(() => bidBoardMapBids(bids, ledgerPrefixMap), [bids, ledgerPrefixMap])
  const addresses = useMemo<AddressToGeocode[]>(() => mapBids.map((b) => ({ key: b.addressKey, display: b.address })), [mapBids])
  const { coords, resolving } = useAddressGeocodeCoords(addresses, !hidden, 'bid board map address_geocodes')
  const { pins, unmapped } = useMemo(() => resolveBidBoardMapPins(mapBids, coords), [mapBids, coords])
  // v2.3205: the unmapped line is a door — the sheet lists every bid the map
  // can't place with its address ready to fix; fixed rows stay for the session
  // so the person sees the pin land.
  const [fixOpen, setFixOpen] = useState(false)
  const [fixedIds, setFixedIds] = useState<ReadonlySet<string>>(() => new Set())
  const fixRows = useMemo(
    () => composeMissingAddressRows({ noAddress, unmapped, pins, resolving, keepIds: fixedIds }),
    [noAddress, unmapped, pins, resolving, fixedIds],
  )
  const saveAddress = useCallback(
    async (target: BidBoardMapBid, address: string): Promise<boolean> => {
      const patch: { address: string; distance_from_office?: string } = { address }
      // A blank distance fills from the new address, the bid form's own rule (v2.3142); a typed number is never overwritten.
      if (!(target.row.distance_from_office ?? '').toString().trim()) {
        const d = await computeBidDistanceToOffice(address).catch(() => null)
        if (d?.ok) patch.distance_from_office = d.milesText
      }
      let rows: ReadonlyArray<{ id: string }> | null
      try {
        rows = await withSupabaseRetry(async () => supabase.from('bids').update(patch).eq('id', target.id).select('id'), 'save bid address from the map')
      } catch (e) {
        showToast(`Couldn't save the address: ${e instanceof Error ? e.message : String(e)}`, 'error')
        return false
      }
      if (bidUpdateRefused(rows)) {
        showToast(BID_UPDATE_NOT_APPLIED_MESSAGE, 'error')
        return false
      }
      setFixedIds((prev) => new Set([...prev, target.id]))
      showToast(patch.distance_from_office ? `Address saved · ${patch.distance_from_office} mi to the office` : 'Address saved — placing it on the map.', 'success')
      onReloadBids()
      return true
    },
    [onReloadBids, showToast],
  )
  const legend = useMemo(() => bidBoardMapLegend(pins), [pins])
  const tourStops = useMemo(() => bidBoardMapTourStops(legend), [legend])
  const tourStopsKey = tourStops.join(',')
  // One timeout per view rather than an interval: a stop that gains or loses pins mid-tour (the
  // geocoder placing the rest) is picked up at the next step, and the unmount cleanup is one clear.
  useEffect(() => {
    if (!tour) return
    const stops = tourStopsKey ? (tourStopsKey.split(',') as SubmissionSectionKey[]) : []
    if (stops.length < 2) {
      setTour(null)
      return
    }
    const t = window.setTimeout(() => {
      const next = bidBoardMapTourNext(tour, stops)
      if (!next) {
        setTour(null)
        return
      }
      setTour(next)
      setShow(bidBoardMapTourVisibility(next))
    }, BID_BOARD_MAP_TOUR_INTERVAL_MS)
    return () => window.clearTimeout(t)
  }, [tour, tourStopsKey])
  const visible = useMemo(() => bidBoardMapVisiblePins(pins, show), [pins, show])
  const byId = useMemo(() => new Map(visible.map((p) => [p.id, p])), [visible])
  const canvasPins = useMemo<MapCanvasPin[]>(
    () =>
      visible.map((p) => ({
        id: p.id,
        lat: p.lat,
        lng: p.lng,
        color: BID_BOARD_MAP_SECTION_COLOR[p.section],
        ringColor: p.dueTone ? BID_BOARD_MAP_DUE_RING_COLOR[p.dueTone] : null,
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
    setTour(null)
    setHidden((h) => {
      writeBidBoardMapHidden(!h)
      return !h
    })
  }, [])
  // A chip click while the tour runs pauses it on the view that is up, then toggles as usual.
  const toggleSection = useCallback((section: SubmissionSectionKey) => {
    setTour(null)
    setShow((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])
  const toggleTour = useCallback(() => {
    if (tour) {
      setTour(null) // Pause holds this view
      return
    }
    const first = bidBoardMapTourNext(null, tourStops)
    if (!first) return
    setTour(first)
    setShow(bidBoardMapTourVisibility(first))
    setSelectedId(null)
  }, [tour, tourStops])
  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (id) onFocusRow(id)
    },
    [onFocusRow],
  )
  const directions = useCallback((p: BidBoardMapPin) => openInExternalBrowser(bidBoardMapDirectionsUrl(p.address)), [])
  const renderPopup = useCallback(
    (id: string) => {
      const p = byId.get(id)
      return p ? <BidPinBody pin={p} onOpenBid={onOpenBid} onEditBid={onEditBid} onDirections={directions} /> : null
    },
    [byId, onOpenBid, onEditBid, directions],
  )

  const total = mapBids.length + noAddress.length
  if (!loading && total === 0) return null

  const unmappedAll = [...unmapped, ...noAddress]
  const unmappedLine = bidBoardMapUnmappedLine(unmappedAll.length)
  const mapHeight = isMobile ? 260 : 380
  const hiddenSectionsWithPins = pins.length > 0 && visible.length === 0

  return (
    <section
      id="bid-board-map-card"
      aria-label="Bids on a map"
      style={{
        border: '1px solid var(--border)',
        borderRadius: isMobile ? 12 : 8,
        background: 'var(--surface)',
        padding: isMobile ? '0.75rem' : '1rem',
        marginTop: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? '0.625rem' : '0.75rem',
        scrollMarginTop: '3.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: 'var(--text-muted)', minWidth: 0 }}>
          <PinGlyph />
          {/* v2.3205: the title is the same toggle as Hide / Show map — one tap on the
              words folds the card, so the eye never has to travel to the far corner. */}
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>
            <button
              type="button"
              onClick={toggleHidden}
              aria-expanded={!hidden}
              title={hidden ? 'Show the map' : 'Hide the map'}
              style={{ background: 'none', border: 'none', padding: 0, margin: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', minHeight: isMobile ? 44 : undefined }}
            >
              Bids on a map
            </button>
          </h3>
          {!hidden && tourStops.length >= 2 ? (
            <button
              type="button"
              onClick={toggleTour}
              aria-pressed={tour != null}
              aria-label={tour ? 'Pause the section tour' : 'Play through the sections'}
              title={tour ? 'Pause — keep the view that is showing' : 'Play — show each section on its own, two seconds each'}
              style={{
                ...OUTLINE_BUTTON_STYLE,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.25rem 0.6rem',
                minHeight: isMobile ? 36 : undefined,
                background: tour ? 'var(--bg-blue-tint)' : 'none',
              }}
            >
              <PlayGlyph playing={tour != null} />
              {tour ? 'Pause' : 'Play'}
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem', flexWrap: 'wrap' }}>
          {!isMobile && !hidden ? <SectionChips legend={legend} show={show} lit={tour} onToggle={toggleSection} isMobile={false} /> : null}
          {!hidden && canvasPins.length > 1 && !isMobile ? (
            <button
              type="button"
              onClick={() => {
                setFitAll(true)
                setFitSignal((n) => n + 1)
              }}
              style={OUTLINE_BUTTON_STYLE}
              title="Frame every pin, including bids far from the office"
            >
              Fit all
            </button>
          ) : null}
          <button type="button" onClick={toggleHidden} aria-expanded={!hidden} style={{ ...LINK_BUTTON_STYLE, minHeight: isMobile ? 44 : undefined }}>
            {hidden ? 'Show map' : isMobile ? 'Hide' : 'Hide map'}
          </button>
        </div>
      </div>

      {hidden ? null : (
        <>
          {isMobile ? <SectionChips legend={legend} show={show} lit={tour} onToggle={toggleSection} isMobile /> : null}

          <div
            // isolation contains Leaflet's internal z-indexes (panes 200–700, controls 1000) so they can't paint over the sticky pill row
            style={{ position: 'relative', height: mapHeight, borderRadius: isMobile ? 10 : 6, overflow: 'hidden', border: '1px solid var(--border)', isolation: 'isolate', background: 'var(--bg-muted)' }}
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
                    ? 'Placing bids on the map…'
                    : 'None of these bids has a map location yet.'}
              </div>
            )}
          </div>

          {isMobile && selected ? (
            <div style={{ border: '1px solid var(--border-blue)', background: 'var(--bg-blue-tint)', borderRadius: 10, padding: '0.625rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: '0.9375rem' }}>{selected.label}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <SectionChip section={selected.section} />
                  {selected.dueLabel ? <DueChip label={selected.dueLabel} tone={selected.dueTone} /> : null}
                  <span>
                    {formatAddressWithoutZip(selected.address)}
                    {bidBoardMapDistanceLine(selected) ? ` · ${bidBoardMapDistanceLine(selected)}` : ''}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {onOpenBid ? (
                  <button type="button" onClick={() => onOpenBid(selected.row)} style={MOBILE_ACTION_STYLE}>
                    Open bid
                  </button>
                ) : null}
                <button type="button" onClick={() => onEditBid(selected.row)} style={MOBILE_ACTION_STYLE}>
                  Edit
                </button>
                <button type="button" onClick={() => directions(selected)} style={MOBILE_ACTION_STYLE}>
                  Directions
                </button>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', fontSize: isMobile ? '0.8125rem' : '0.875rem', color: 'var(--text-muted)' }}>
            {!isMobile ? (
              <span>
                Click a pin to see the bid; its row lights up below.
                {anchor ? ' Rings are 25 and 50 miles from the office.' : ''}
                {' '}Sections toggle pins only.
              </span>
            ) : null}
            {resolving && unmapped.length > 0 ? (
              <span>{unmapped.length === 1 ? 'Placing 1 more bid…' : `Placing ${unmapped.length} more bids…`}</span>
            ) : unmappedLine ? (
              <span>
                <button type="button" onClick={() => setFixOpen(true)} style={{ ...LINK_BUTTON_STYLE, textDecoration: 'underline', minHeight: isMobile ? 44 : undefined }} title="List these bids and type their addresses">
                  {unmappedLine} · {unmappedAll.length === 1 ? 'add its address' : 'add their addresses'}
                </button>
              </span>
            ) : resolving && pins.length > 0 ? (
              <span>Placing the rest…</span>
            ) : null}
          </div>
        </>
      )}
      <BidBoardMissingAddressesModal
        open={fixOpen}
        rows={fixRows}
        isMobile={isMobile}
        onClose={() => setFixOpen(false)}
        onSave={saveAddress}
        onEditBid={(b) => onEditBid(b.row)}
        onFocusRow={(id) => { setFixOpen(false); onFocusRow(id) }}
      />
    </section>
  )
}
