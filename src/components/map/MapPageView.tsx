import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
// Leaflet / react-leaflet / Geoman: import only from this file so they stay in the lazy Map route chunk.
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Popup,
  useMap,
} from 'react-leaflet'
import { booleanPointInPolygon, point } from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import '@geoman-io/leaflet-geoman-free'
import { useMapPageData, type GeocodeAddressRow, type MapPageEntity } from '../../hooks/useMapPageData'
import { useJobFormModal } from '../../contexts/JobFormModalContext'
import { MapGeocodeReviewModal } from './MapGeocodeReviewModal'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'
import {
  DEFAULT_MAP_FALLBACK_CENTER,
  DEFAULT_MAP_FALLBACK_ZOOM,
  fetchMapDefaultViewFromAppSettings,
} from '../../lib/mapDefaultViewSettings'
import { mapEntityMatchesSearch } from '../../lib/map/mapEntitySearch'
import { DEFAULT_MAP_BID_STAGES, mapEntityPassesLayerFilter } from '../../lib/map/mapLayerFilter'
import type { SubmissionSectionKey } from '../../lib/bids/submissionSections'

const openLinkLikeStyle: CSSProperties = {
  color: 'var(--text-link)',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textDecoration: 'underline',
  font: 'inherit',
}

const KIND_COLOR: Record<MapPageEntity['kind'], string> = {
  job: '#2563eb',
  bid: '#ea580c',
  estimate: '#16a34a',
}

const KIND_LABEL: Record<MapPageEntity['kind'], string> = {
  job: 'Jobs',
  bid: 'Bids',
  estimate: 'Estimates',
}

/** Color key overlaid on the map corner; layers toggled off in the header show dimmed. */
function MapLegend({ show }: { show: Record<MapPageEntity['kind'], boolean> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.3rem',
        padding: '0.45rem 0.7rem',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.2,
        color: 'var(--text-700)',
      }}
    >
      {(Object.keys(KIND_LABEL) as MapPageEntity['kind'][]).map((kind) => (
        <div
          key={kind}
          style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', opacity: show[kind] ? 1 : 0.35 }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              boxSizing: 'border-box',
              background: KIND_COLOR[kind],
              opacity: 0.85,
            }}
          />
          {KIND_LABEL[kind]}
        </div>
      ))}
    </div>
  )
}

const KIND_PILL_ACTIVE: Record<MapPageEntity['kind'], { bg: string; text: string }> = {
  job: { bg: 'var(--bg-blue-tint)', text: 'var(--text-blue-700)' },
  bid: { bg: 'var(--bg-orange-tint)', text: 'var(--text-orange-700)' },
  estimate: { bg: 'var(--bg-green-tint)', text: 'var(--text-green-600)' },
}

/** Header toggle for one map layer; the dot matches that kind's marker color. */
function LayerPill({
  kind,
  label,
  active,
  onToggle,
}: {
  kind: MapPageEntity['kind']
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={active ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.3rem 0.8rem',
        borderRadius: 999,
        border: `1px solid ${active ? KIND_COLOR[kind] : 'var(--border)'}`,
        background: active ? KIND_PILL_ACTIVE[kind].bg : 'transparent',
        color: active ? KIND_PILL_ACTIVE[kind].text : 'var(--text-muted)',
        fontSize: '0.8125rem',
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? KIND_COLOR[kind] : 'var(--text-faint-300)',
          transition: 'background 120ms ease',
        }}
      />
      {label}
    </button>
  )
}

/** Bid stage sub-filters; keys and meanings match the Bid Board sections (submissionSections kernel). */
const BID_STAGE_META: { key: SubmissionSectionKey; label: string; title: string }[] = [
  { key: 'unsent', label: 'Unsent', title: 'Unsent / Working Bids' },
  { key: 'pending', label: 'Pending', title: 'Not yet won or lost' },
  { key: 'won', label: 'Won', title: 'Won' },
  { key: 'startedOrComplete', label: 'Started', title: 'Started or Complete' },
  { key: 'lost', label: 'Lost', title: 'Lost' },
]

const BID_STAGE_TITLE: Record<SubmissionSectionKey, string> = Object.fromEntries(
  BID_STAGE_META.map((m) => [m.key, m.title])
) as Record<SubmissionSectionKey, string>

/** Compact toggle for one bid stage; shown only while the Bids layer is on. */
function BidStageChip({
  label,
  title,
  active,
  onToggle,
}: {
  label: string
  title: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: 999,
        border: `1px solid ${active ? KIND_COLOR.bid : 'var(--border)'}`,
        background: active ? KIND_PILL_ACTIVE.bid.bg : 'transparent',
        color: active ? KIND_PILL_ACTIVE.bid.text : 'var(--text-muted)',
        fontSize: '0.75rem',
        fontWeight: 500,
        lineHeight: 1.2,
        cursor: 'pointer',
        transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
      }}
    >
      {label}
    </button>
  )
}

const headerToolbarButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.3rem 0.8rem',
  borderRadius: 8,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text-700)',
  fontSize: '0.8125rem',
  fontWeight: 500,
  lineHeight: 1.2,
  cursor: 'pointer',
}

function FitBoundsToEntities({ points }: { points: [number, number][] }) {
  const map = useMap()
  const doneRef = useRef(false)
  useEffect(() => {
    if (points.length === 0) return
    const b = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)))
    if (!b.isValid()) return
    if (!doneRef.current) {
      map.fitBounds(b, { padding: [32, 32], maxZoom: 12 })
      doneRef.current = true
    }
  }, [map, points])
  return null
}

/** One-shot fly-to from geocode / table actions; does not remount MapContainer. */
function MapFlyTo({
  target,
  onConsumed,
}: {
  target: { lat: number; lng: number } | null
  onConsumed: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const z = map.getZoom()
    map.flyTo([target.lat, target.lng], Math.max(z, 14), { duration: 0.45 })
    const id = window.setTimeout(() => {
      onConsumed()
    }, 0)
    return () => {
      clearTimeout(id)
    }
  }, [map, target, onConsumed])
  return null
}

function GeomanDraw({
  onFilterPolygon,
  clearSignal,
}: {
  onFilterPolygon: (poly: Feature<Polygon> | null) => void
  clearSignal: number
}) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    const m = map as L.Map & {
      pm: { addControls: (o: Record<string, unknown>) => void; removeControls: () => void }
    }
    m.pm.addControls({
      position: 'topleft',
      oneBlock: true,
    })

    const onCreate = (ev: { layer: L.Layer }) => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      const lr = (ev as { layer: L.Polygon }).layer
      layerRef.current = lr
      const gj = lr.toGeoJSON() as Feature<Polygon>
      onFilterPolygon(gj)
    }

    // Geoman custom events; not in Leaflet typings
    type MapWithPm = L.Map & { on: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map; off: (t: string, h: (e: { layer: L.Layer }) => void) => L.Map }
    ;(map as unknown as MapWithPm).on('pm:create', onCreate)

    return () => {
      ;(map as unknown as MapWithPm).off('pm:create', onCreate)
      if (layerRef.current) {
        map.removeLayer(layerRef.current)
        layerRef.current = null
      }
      m.pm.removeControls()
    }
  }, [map, onFilterPolygon])

  useEffect(() => {
    if (clearSignal === 0) return
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
      layerRef.current = null
    }
    onFilterPolygon(null)
  }, [clearSignal, map, onFilterPolygon])

  return null
}

function filterEntitiesByPolygon(entities: MapPageEntity[], poly: Feature<Polygon> | null): MapPageEntity[] {
  if (!poly) return entities
  return entities.filter((e) => {
    if (e.lat == null || e.lng == null) return false
    return booleanPointInPolygon(point([e.lng, e.lat]), poly)
  })
}

/** Shown when geocoding runs; `open` follows progress until all rows are terminal. */
function GeocodeProgressList({
  rows,
  entities,
  onAddressOpen,
}: {
  rows: GeocodeAddressRow[]
  entities: MapPageEntity[]
  onAddressOpen: (addressNormalized: string) => void
}) {
  if (rows.length === 0) return null
  const done = rows.filter((r) => r.status === 'ok' || r.status === 'error').length
  const anyActive = rows.some((r) => r.status === 'pending' || r.status === 'in_progress')
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        margin: 0,
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      <details
        open={anyActive}
        style={{
          fontSize: '0.875rem',
          color: 'var(--text-700)',
          margin: 0,
          minWidth: 'min(18rem, 100%)',
        }}
      >
        <summary style={{ cursor: 'pointer', userSelect: 'none' }}>{`Geocoding (${done}/${rows.length})`}</summary>
        <ul
          aria-live="polite"
          style={{
            margin: '0.5rem 0 0 0',
            padding: '0 0 0 1.1rem',
            listStyle: 'none',
            maxHeight: 'min(40vh, 240px)',
            overflowY: 'auto',
          }}
        >
        {rows.map((r) => {
          const icon = r.status === 'ok' ? '✓' : r.status === 'error' ? '✗' : r.status === 'in_progress' ? '…' : '·'
          const matched = entities.filter((e) => e.addressKey === r.address_normalized)
          const hasEntity = matched.length > 0
          // Job/bid/estimate numbers for this address; several entities can share one address.
          const ids = [...new Set(matched.map((e) => e.sublabel.trim()).filter((s) => s.length > 0))]
          const idPrefix = ids.slice(0, 3).join(', ') + (ids.length > 3 ? ` +${ids.length - 3} more` : '')
          return (
            <li
              key={r.address_normalized}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.25rem' }}
            >
              <span aria-hidden="true" style={{ width: '0.9rem' }}>
                {icon}
              </span>
              {idPrefix.length > 0 ? (
                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{idPrefix}</span>
              ) : null}
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{r.addressLabel}</span>
              {hasEntity ? (
                <button
                  type="button"
                  onClick={() => onAddressOpen(r.address_normalized)}
                  style={openLinkLikeStyle}
                  aria-label={`Open job, bid, or estimate for this address: ${r.addressLabel}`}
                >
                  Open
                </button>
              ) : null}
              {r.errorMessage ? <span style={{ color: 'var(--text-red-700)' }}>{r.errorMessage}</span> : null}
            </li>
          )
        })}
        </ul>
      </details>
    </div>
  )
}

function MapEntityTable({
  rows,
  title,
  titleRight,
  emptyHint,
  onOpenJob,
}: {
  rows: MapPageEntity[]
  title: string
  /** e.g. filter search — shown to the right of the title on wide viewports. */
  titleRight?: ReactNode
  emptyHint: string
  /** When set, job rows open Edit Job in place instead of navigating to Jobs. */
  onOpenJob?: (jobId: string) => void
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <h2 style={{ fontSize: '1rem', margin: 0, flex: '1 1 auto', minWidth: 0 }}>{title}</h2>
        {titleRight != null ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: 'flex-end',
              flex: '1 1 200px',
              minWidth: 0,
            }}
          >
            {titleRight}
          </div>
        ) : null}
      </div>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 4,
          maxHeight: 'min(50vh, 360px)',
          overflow: 'auto',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '0.8125rem',
          }}
        >
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Kind</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Address</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Info</th>
              <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem' }}>Open</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                  {emptyHint}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{r.kind}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>{r.tableLabel}</td>
                  <td style={{ padding: '0.35rem 0.5rem', color: 'var(--text-700)' }}>{r.addressLabel}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>{r.meta || '—'}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>
                    {r.kind === 'job' && onOpenJob ? (
                      <button type="button" onClick={() => onOpenJob(r.id)} style={openLinkLikeStyle}>
                        Open
                      </button>
                    ) : (
                      <Link to={r.linkTo} style={{ color: 'var(--text-link)' }}>
                        Open
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MapPageView() {
  const navigate = useNavigate()
  const { loading, error, entities, geocodeAddressRows, geocodeInProgress, reload } = useMapPageData(true)
  const jobFormModal = useJobFormModal()
  const openJobOnMap = useCallback(
    (jobId: string) => {
      jobFormModal?.openEditJob(jobId, {
        onSaved: () => void reload(),
      })
    },
    [jobFormModal, reload]
  )
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number } | null>(null)
  const clearMapFlyTo = useCallback(() => setMapFlyTo(null), [])
  const [geocodeChooserMatches, setGeocodeChooserMatches] = useState<MapPageEntity[] | null>(null)
  const openEntity = useCallback(
    (e: MapPageEntity) => {
      if (e.kind === 'job' && jobFormModal) {
        openJobOnMap(e.id)
      } else {
        navigate(e.linkTo)
      }
      if (e.lat != null && e.lng != null) {
        setMapFlyTo({ lat: e.lat, lng: e.lng })
      }
    },
    [jobFormModal, navigate, openJobOnMap]
  )
  const onGeocodeAddressOpen = useCallback(
    (addressNormalized: string) => {
      const matches = entities.filter((en) => en.addressKey === addressNormalized)
      if (matches.length === 0) return
      if (matches.length === 1) {
        openEntity(matches[0]!)
        return
      }
      setGeocodeChooserMatches(matches)
    },
    [entities, openEntity]
  )
  const [reviewOpen, setReviewOpen] = useState(false)
  const narrow = useNarrowViewport640()
  const [showJobs, setShowJobs] = useState(true)
  const [showBids, setShowBids] = useState(true)
  const [showEst, setShowEst] = useState(true)
  const [bidStages, setBidStages] = useState<Record<SubmissionSectionKey, boolean>>(DEFAULT_MAP_BID_STAGES)
  const [mapSearchQuery, setMapSearchQuery] = useState('')
  const [filterPoly, setFilterPoly] = useState<Feature<Polygon> | null>(null)
  const [clearDraw, setClearDraw] = useState(0)
  const [mapView, setMapView] = useState<{
    lat: number
    lng: number
    zoom: number
  }>(() => ({
    lat: DEFAULT_MAP_FALLBACK_CENTER.lat,
    lng: DEFAULT_MAP_FALLBACK_CENTER.lng,
    zoom: DEFAULT_MAP_FALLBACK_ZOOM,
  }))

  const loadMapDefaultView = useCallback(() => {
    void (async () => {
      try {
        const v = await fetchMapDefaultViewFromAppSettings()
        if (v) {
          setMapView({ lat: v.centerLat, lng: v.centerLng, zoom: v.zoom })
        } else {
          setMapView({
            lat: DEFAULT_MAP_FALLBACK_CENTER.lat,
            lng: DEFAULT_MAP_FALLBACK_CENTER.lng,
            zoom: DEFAULT_MAP_FALLBACK_ZOOM,
          })
        }
      } catch {
        // keep current mapView
      }
    })()
  }, [])

  useEffect(() => {
    loadMapDefaultView()
  }, [loadMapDefaultView])

  const onFilterPolygon = useCallback((poly: Feature<Polygon> | null) => {
    setFilterPoly(poly)
  }, [])

  const visible = useMemo(() => {
    const f = { showJobs, showBids, showEst, bidStages }
    return entities.filter((e) => mapEntityPassesLayerFilter(e, f))
  }, [entities, showJobs, showBids, showEst, bidStages])

  const mapSearchTrim = useMemo(() => mapSearchQuery.trim(), [mapSearchQuery])

  const searchFiltered = useMemo(() => {
    if (mapSearchTrim.length === 0) return visible
    return visible.filter((e) => mapEntityMatchesSearch(mapSearchTrim, e))
  }, [visible, mapSearchTrim])

  const withCoords = useMemo(
    () => searchFiltered.filter((e) => e.lat != null && e.lng != null),
    [searchFiltered]
  )
  const points = useMemo((): [number, number][] => withCoords.map((e) => [e.lat!, e.lng!]), [withCoords])
  const tableRows = useMemo(
    () => filterEntitiesByPolygon(searchFiltered, filterPoly),
    [searchFiltered, filterPoly]
  )

  const tableTitle = useMemo(() => {
    if (mapSearchTrim.length > 0) return 'Search results'
    if (filterPoly) return 'In drawn area'
    return 'All visible layers'
  }, [mapSearchTrim, filterPoly])

  const tableEmptyHint = useMemo(() => {
    if (mapSearchTrim.length > 0 && searchFiltered.length === 0) {
      return visible.length > 0
        ? 'No matches for this search.'
        : 'No items in the selected layers.'
    }
    if (filterPoly) {
      return 'No pins in this area. Clear the draw or pick another region.'
    }
    return 'No rows with a geocoded address. Use Reload after geocoding finishes, or add addresses to jobs/bids/estimates.'
  }, [mapSearchTrim, searchFiltered.length, visible.length, filterPoly])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', rowGap: '0.6rem' }}>
        <h1 style={{ margin: 0, marginRight: '0.25rem', fontSize: '1.25rem' }}>Map</h1>
        <LayerPill kind="job" label="Jobs" active={showJobs} onToggle={() => setShowJobs((s) => !s)} />
        <LayerPill kind="bid" label="Bids" active={showBids} onToggle={() => setShowBids((s) => !s)} />
        {showBids ? (
          <div role="group" aria-label="Bid stages" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            {BID_STAGE_META.map((m) => (
              <BidStageChip
                key={m.key}
                label={m.label}
                title={m.title}
                active={bidStages[m.key]}
                onToggle={() => setBidStages((prev) => ({ ...prev, [m.key]: !prev[m.key] }))}
              />
            ))}
          </div>
        ) : null}
        <LayerPill kind="estimate" label="Estimates" active={showEst} onToggle={() => setShowEst((s) => !s)} />
        <GeocodeProgressList rows={geocodeAddressRows} entities={entities} onAddressOpen={onGeocodeAddressOpen} />
        <div style={{ display: 'inline-flex', gap: '0.5rem', marginLeft: 'auto' }}>
          <button
            type="button"
            onClick={() => setClearDraw((c) => c + 1)}
            disabled={!filterPoly}
            title={filterPoly ? 'Remove the drawn area filter' : 'Draw an area on the map to filter first'}
            style={{
              ...headerToolbarButtonStyle,
              opacity: filterPoly ? 1 : 0.45,
              cursor: filterPoly ? 'pointer' : 'default',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            Clear draw
          </button>
          <button
            type="button"
            onClick={() => {
              void reload()
              loadMapDefaultView()
            }}
            disabled={loading}
            style={{
              ...headerToolbarButtonStyle,
              opacity: loading ? 0.45 : 1,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v5h-5" />
            </svg>
            {loading ? 'Reloading…' : 'Reload data'}
          </button>
        </div>
      </div>

      <MapGeocodeReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        entitiesWithCoords={withCoords}
        onAfterRefresh={() => void reload()}
      />

      {geocodeChooserMatches && geocodeChooserMatches.length > 0 ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
          }}
          role="dialog"
          aria-modal
          aria-labelledby="geocode-chooser-title"
        >
          <div
            style={{
              background: 'var(--surface)',
              padding: '1.25rem',
              borderRadius: 8,
              minWidth: 280,
              maxWidth: 'min(96vw, 420px)',
              maxHeight: 'min(80vh, 400px)',
              overflow: 'auto',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
          >
            <h2 id="geocode-chooser-title" style={{ margin: '0 0 0.75rem 0', fontSize: '1.05rem' }}>
              Multiple records at this address
            </h2>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-600)' }}>Choose which to open.</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {geocodeChooserMatches.map((e) => (
                <li key={`${e.kind}-${e.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setGeocodeChooserMatches(null)
                      openEntity(e)
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.65rem 0.25rem',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize', fontWeight: 600, marginRight: '0.35rem' }}>{e.kind}</span>
                    <span>{e.tableLabel}</span>
                    {e.sublabel ? <span style={{ color: 'var(--text-muted)' }}>{` ${e.sublabel}`}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setGeocodeChooserMatches(null)}
              style={{ marginTop: '0.75rem', padding: '0.5rem 0.9rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {!loading && geocodeInProgress ? (
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>Resolving addresses…</p>
      ) : null}

      {error ? <p style={{ color: 'var(--text-red-700)', margin: 0 }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0, color: 'var(--text-muted)' }}>Loading…</p> : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          flex: 1,
          minHeight: 420,
          minWidth: 0,
        }}
      >
        {/* isolation contains Leaflet's internal z-indexes (panes 200-700, controls 1000) so they can't paint over header dropdowns */}
        <div style={{ position: 'relative', flex: '0 0 auto', minHeight: 360, minWidth: 0, border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', isolation: 'isolate' }}>
          <MapContainer
            key={`${mapView.lat}-${mapView.lng}-${mapView.zoom}`}
            center={[mapView.lat, mapView.lng] as L.LatLngExpression}
            zoom={mapView.zoom}
            style={{ width: '100%', height: narrow ? 360 : 520 }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapFlyTo target={mapFlyTo} onConsumed={clearMapFlyTo} />
            {points.length > 0 ? <FitBoundsToEntities points={points} /> : null}
            <GeomanDraw onFilterPolygon={onFilterPolygon} clearSignal={clearDraw} />
            {withCoords.map((e) => (
              <CircleMarker
                key={`${e.kind}-${e.id}`}
                center={[e.lat!, e.lng!]}
                radius={7}
                pathOptions={{ color: KIND_COLOR[e.kind], fillColor: KIND_COLOR[e.kind], fillOpacity: 0.7, weight: 1 }}
              >
                <Popup>
                  <div style={{ fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                      {e.kind}
                      {e.kind === 'bid' && e.bidSection ? (
                        <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>
                          {` — ${BID_STAGE_TITLE[e.bidSection]}`}
                        </span>
                      ) : null}
                    </div>
                    <div>{e.tableLabel}</div>
                    <div style={{ color: 'var(--text-muted)' }}>{e.addressLabel}</div>
                    {e.kind === 'job' && jobFormModal ? (
                      <button type="button" onClick={() => openJobOnMap(e.id)} style={openLinkLikeStyle}>
                        Open
                      </button>
                    ) : (
                      <Link to={e.linkTo}>Open</Link>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <MapLegend show={{ job: showJobs, bid: showBids, estimate: showEst }} />
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
          <MapEntityTable
            rows={tableRows}
            title={tableTitle}
            titleRight={
              <>
                <label htmlFor="map-page-search" style={{ fontSize: '0.875rem', color: 'var(--text-700)' }}>
                  Filter
                </label>
                <input
                  id="map-page-search"
                  type="search"
                  name="map-page-search"
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  autoComplete="off"
                  placeholder="Filter by name, address, number…"
                  aria-label="Filter map and list"
                  style={{
                    flex: '1 1 200px',
                    minWidth: 0,
                    maxWidth: '100%',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.875rem',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 4,
                  }}
                />
                {mapSearchTrim ? (
                  <button
                    type="button"
                    onClick={() => setMapSearchQuery('')}
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                ) : null}
              </>
            }
            emptyHint={tableEmptyHint}
            onOpenJob={jobFormModal ? openJobOnMap : undefined}
          />
        </div>
      </div>

      <details
        style={{
          position: 'fixed',
          zIndex: 300,
          right: 'max(1rem, env(safe-area-inset-right, 0px))',
          bottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
          maxWidth: 'min(100vw - 2rem, 240px)',
          margin: 0,
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontSize: '0.875rem',
            padding: '0.35rem 0.6rem',
            background: 'var(--bg-muted)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            listStyle: 'none',
            userSelect: 'none',
          }}
          aria-label="Debug tools"
        >
          Debug
        </summary>
        <div
          style={{
            marginTop: 6,
            padding: '0.5rem',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer', width: '100%' }}
          >
            Review geocodes
          </button>
        </div>
      </details>
    </div>
  )
}
