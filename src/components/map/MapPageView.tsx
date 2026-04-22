import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { MapGeocodeReviewModal } from './MapGeocodeReviewModal'
import { useNarrowViewport640 } from '../../hooks/useNarrowViewport640'

const CHICAGO_CENTER: L.LatLngExpression = [41.878, -87.63]

const KIND_COLOR: Record<MapPageEntity['kind'], string> = {
  job: '#2563eb',
  bid: '#ea580c',
  estimate: '#16a34a',
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
function GeocodeProgressList({ rows }: { rows: GeocodeAddressRow[] }) {
  if (rows.length === 0) return null
  const done = rows.filter((r) => r.status === 'ok' || r.status === 'error').length
  const anyActive = rows.some((r) => r.status === 'pending' || r.status === 'in_progress')
  return (
    <details open={anyActive} style={{ fontSize: '0.875rem', color: '#374151' }}>
      <summary style={{ cursor: 'pointer', userSelect: 'none' }}>{`Geocoding (${done}/${rows.length})`}</summary>
      <ul
        aria-live="polite"
        style={{ margin: '0.5rem 0 0 0', padding: '0 0 0 1.1rem', listStyle: 'none' }}
      >
        {rows.map((r) => {
          const icon = r.status === 'ok' ? '✓' : r.status === 'error' ? '✗' : r.status === 'in_progress' ? '…' : '·'
          return (
            <li
              key={r.address_normalized}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.25rem' }}
            >
              <span aria-hidden="true" style={{ width: '0.9rem' }}>
                {icon}
              </span>
              <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{r.addressLabel}</span>
              {r.errorMessage ? <span style={{ color: '#b91c1c' }}>{r.errorMessage}</span> : null}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

function MapEntityTable({
  rows,
  title,
  emptyHint,
}: {
  rows: MapPageEntity[]
  title: string
  emptyHint: string
}) {
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem 0' }}>{title}</h2>
      <div
        style={{
          border: '1px solid #e5e7eb',
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
            <tr style={{ background: '#f9fafb' }}>
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
                <td colSpan={5} style={{ padding: '0.75rem', color: '#6b7280' }}>
                  {emptyHint}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{r.kind}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>{r.tableLabel}</td>
                  <td style={{ padding: '0.35rem 0.5rem', color: '#374151' }}>{r.addressLabel}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>{r.meta || '—'}</td>
                  <td style={{ padding: '0.35rem 0.5rem' }}>
                    <Link to={r.linkTo} style={{ color: '#2563eb' }}>
                      Open
                    </Link>
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
  const { loading, error, entities, geocodeAddressRows, reload } = useMapPageData(true)
  const [reviewOpen, setReviewOpen] = useState(false)
  const narrow = useNarrowViewport640()
  const [showJobs, setShowJobs] = useState(true)
  const [showBids, setShowBids] = useState(true)
  const [showEst, setShowEst] = useState(true)
  const [filterPoly, setFilterPoly] = useState<Feature<Polygon> | null>(null)
  const [clearDraw, setClearDraw] = useState(0)

  const onFilterPolygon = useCallback((poly: Feature<Polygon> | null) => {
    setFilterPoly(poly)
  }, [])

  const visible = useMemo(() => {
    return entities.filter(
      (e) =>
        (e.kind === 'job' && showJobs) ||
        (e.kind === 'bid' && showBids) ||
        (e.kind === 'estimate' && showEst)
    )
  }, [entities, showJobs, showBids, showEst])

  const withCoords = useMemo(() => visible.filter((e) => e.lat != null && e.lng != null), [visible])
  const points = useMemo((): [number, number][] => withCoords.map((e) => [e.lat!, e.lng!]), [withCoords])
  const tableRows = useMemo(() => filterEntitiesByPolygon(visible, filterPoly), [visible, filterPoly])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Map</h1>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={showJobs} onChange={() => setShowJobs((s) => !s)} />
          Jobs
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={showBids} onChange={() => setShowBids((s) => !s)} />
          Bids
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
          <input type="checkbox" checked={showEst} onChange={() => setShowEst((s) => !s)} />
          Estimates
        </label>
        <button
          type="button"
          onClick={() => setClearDraw((c) => c + 1)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          Clear draw
        </button>
        <button type="button" onClick={() => void reload()} style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
          Reload data
        </button>
        <button
          type="button"
          onClick={() => setReviewOpen(true)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}
        >
          Review geocodes
        </button>
      </div>

      <MapGeocodeReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        entitiesWithCoords={withCoords}
        onAfterRefresh={() => void reload()}
      />

      <GeocodeProgressList rows={geocodeAddressRows} />

      {error ? <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p> : null}
      {loading ? <p style={{ margin: 0, color: '#6b7280' }}>Loading…</p> : null}

      <div
        style={{
          display: 'flex',
          flexDirection: narrow ? 'column' : 'row',
          gap: '0.75rem',
          flex: 1,
          minHeight: 420,
        }}
      >
        <div style={{ flex: '1 1 55%', minHeight: 360, minWidth: 0, border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
          <MapContainer
            center={CHICAGO_CENTER}
            zoom={10}
            style={{ width: '100%', height: narrow ? 360 : 520 }}
            scrollWheelZoom
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
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
                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{e.kind}</div>
                    <div>{e.tableLabel}</div>
                    <div style={{ color: '#6b7280' }}>{e.addressLabel}</div>
                    <Link to={e.linkTo}>Open</Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
        <div style={{ flex: '1 1 40%', minWidth: 0, maxWidth: narrow ? '100%' : 520 }}>
          <MapEntityTable
            rows={tableRows}
            title={filterPoly ? 'In drawn area' : 'All visible layers'}
            emptyHint={
              filterPoly
                ? 'No pins in this area. Clear the draw or pick another region.'
                : 'No rows with a geocoded address. Use Reload after geocoding finishes, or add addresses to jobs/bids/estimates.'
            }
          />
        </div>
      </div>
    </div>
  )
}
