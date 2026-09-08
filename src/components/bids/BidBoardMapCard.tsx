/**
 * Bid Board "Bids on a map" card (v2.3162) — every Bid Board viewer.
 *
 * Plots the bids the board is showing: the same filtered rows (search, trade
 * pill, My bids), one pin per bid with an address, colored by board section.
 * Mounts between the section pills and the first section; renders nothing when
 * there is no bid to show. Collapsible: **Hide map** keeps the header line and
 * remembers the choice per device; the board's **Map** pill reveals it again.
 *
 * Interactions: a pin selects the bid — its popup (desktop) / bar (phone)
 * carries Open bid (the preview modal), Edit (Edit Bid) and Directions — and
 * lights the bid's row on the board below (`onFocusRow`). The legend chips
 * toggle sections on the map only, never on the board. The office anchor and
 * its 25 / 50 mile rings come from the same setting the bid form's Distance
 * to Office auto-fill uses (`resolveOfficeAnchor`). Google Maps when a
 * browser key is configured and loads, OpenStreetMap otherwise — the
 * Dashboard card's provider rule.
 */
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import { useAddressGeocodeCoords, type AddressToGeocode } from '../../hooks/useAddressGeocodeCoords'
import { googleMapsBrowserKey, resolveDashboardMapProvider } from '../../lib/dashboardJobsMap'
import { useOfficeAnchor } from '../../hooks/useOfficeAnchor'
import { openInExternalBrowser } from '../../lib/openInExternalBrowser'
import { formatAddressWithoutZip } from '../../lib/bids/bidContactInfo'
import {
  BID_BOARD_MAP_DEFAULT_SECTIONS,
  BID_BOARD_MAP_DUE_RING_COLOR,
  BID_BOARD_MAP_RING_MILES,
  BID_BOARD_MAP_SECTION_COLOR,
  BID_BOARD_MAP_SECTION_LABEL,
  bidBoardMapBids,
  bidBoardMapDirectionsUrl,
  bidBoardMapDistanceLine,
  bidBoardMapHomeFitPoints,
  bidBoardMapLegend,
  bidBoardMapUnmappedLine,
  bidBoardMapVisiblePins,
  readBidBoardMapHidden,
  resolveBidBoardMapPins,
  writeBidBoardMapHidden,
  type BidBoardMapDueTone,
  type BidBoardMapPin,
  type BidBoardMapSectionVisibility,
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
  onToggle,
  isMobile,
}: {
  legend: { section: SubmissionSectionKey; count: number }[]
  show: BidBoardMapSectionVisibility
  onToggle: (section: SubmissionSectionKey) => void
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
        const c = BID_BOARD_MAP_SECTION_COLOR[l.section]
        return (
          <button
            key={l.section}
            type="button"
            onClick={() => onToggle(l.section)}
            aria-pressed={on}
            title={on ? `Hide ${BID_BOARD_MAP_SECTION_LABEL[l.section]} pins` : `Show ${BID_BOARD_MAP_SECTION_LABEL[l.section]} pins`}
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
            {BID_BOARD_MAP_SECTION_LABEL[l.section]}
            <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{l.count}</span>
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
}) {
  const [hidden, setHidden] = useState<boolean>(() => readBidBoardMapHidden())
  useEffect(() => {
    if (revealSignal > 0) {
      setHidden(false)
      writeBidBoardMapHidden(false)
    }
  }, [revealSignal])
  const [show, setShow] = useState<BidBoardMapSectionVisibility>(() => ({ ...BID_BOARD_MAP_DEFAULT_SECTIONS }))
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
  const legend = useMemo(() => bidBoardMapLegend(pins), [pins])
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
    setHidden((h) => {
      writeBidBoardMapHidden(!h)
      return !h
    })
  }, [])
  const toggleSection = useCallback((section: SubmissionSectionKey) => setShow((prev) => ({ ...prev, [section]: !prev[section] })), [])
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
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-strong)' }}>Bids on a map</h3>
          {!isMobile && !hidden ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>follows the search and the trade pill</span> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.875rem', flexWrap: 'wrap' }}>
          {!isMobile && !hidden ? <SectionChips legend={legend} show={show} onToggle={toggleSection} isMobile={false} /> : null}
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
          {isMobile ? <SectionChips legend={legend} show={show} onToggle={toggleSection} isMobile /> : null}

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
                {unmappedLine}
                {unmappedAll.length <= 3
                  ? unmappedAll.map((b) => (
                      <span key={b.id}>
                        {' · '}
                        <button type="button" onClick={() => onFocusRow(b.id)} style={LINK_BUTTON_STYLE} title="Show this bid's row">
                          {b.label}
                        </button>
                      </span>
                    ))
                  : null}
              </span>
            ) : resolving && pins.length > 0 ? (
              <span>Placing the rest…</span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
