/**
 * The Leaflet half of the Dashboard "Your jobs on a map" card (v2.3131).
 *
 * Lazy-loaded by `DashboardJobsMapCard` so Leaflet / react-leaflet stay out of
 * the Dashboard bundle (they already ride in the lazy /map chunk; Vite shares
 * the vendor chunk between the two). Renders the tiles, one circle marker per
 * pin in the Jobs status colors, fit-to-all, and — on desktop — a Leaflet
 * popup with Open job / Directions. On a phone the popup is skipped: the card
 * shows the selected job as a bar under the map (44px buttons, pin visible).
 */
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import {
  DASHBOARD_JOBS_MAP_STATUS_COLOR,
  DASHBOARD_JOBS_MAP_STATUS_LABEL,
  dashboardJobsMapBounds,
  dashboardJobsMapDetailLine,
  type DashboardJobsMapPin,
} from '../../lib/dashboardJobsMap'

export type DashboardJobsMapCanvasProps = {
  pins: DashboardJobsMapPin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onOpenJob: (pin: DashboardJobsMapPin) => void
  onDirections: (pin: DashboardJobsMapPin) => void
  /** Bumped by the card's Fit all button. */
  fitSignal: number
  height: number
  /** Phone form: no popup; the card renders the selected bar. */
  isMobile: boolean
}

function FitToPins({ pins, fitSignal }: { pins: DashboardJobsMapPin[]; fitSignal: number }) {
  const map = useMap()
  const b = dashboardJobsMapBounds(pins)
  const key = b ? `${b.south},${b.west},${b.north},${b.east}` : ''
  useEffect(() => {
    if (!b) return
    map.fitBounds(
      L.latLngBounds([b.south, b.west], [b.north, b.east]),
      { padding: [28, 28], maxZoom: 15 },
    )
    // key captures the bounds; fitSignal re-fits on demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, fitSignal])
  return null
}

const POPUP_BUTTON_STYLE: React.CSSProperties = {
  flex: 1,
  padding: '0.35rem 0.75rem',
  fontSize: '0.875rem',
  background: 'var(--surface)',
  color: 'var(--text-link)',
  border: '1px solid #2563eb',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export default function DashboardJobsMapCanvas({ pins, selectedId, onSelect, onOpenJob, onDirections, fitSignal, height, isMobile }: DashboardJobsMapCanvasProps) {
  const first = pins[0]
  const center: L.LatLngExpression = first ? [first.lat, first.lng] : [39.5, -98.35]
  return (
    <MapContainer center={center} zoom={first ? 12 : 4} style={{ width: '100%', height }} scrollWheelZoom={!isMobile} attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPins pins={pins} fitSignal={fitSignal} />
      {pins.map((p) => {
        const c = DASHBOARD_JOBS_MAP_STATUS_COLOR[p.status]
        const selected = p.id === selectedId
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={selected ? 10 : isMobile ? 9 : 8}
            pathOptions={{ color: selected ? '#1d4ed8' : c, fillColor: c, fillOpacity: selected ? 0.9 : 0.8, weight: selected ? 2 : 1 }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            {!isMobile ? (
              <Popup>
                <div style={{ fontSize: '0.8125rem', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{p.label}</div>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: c,
                        border: `1px solid ${c}`,
                        borderRadius: 999,
                        padding: '1px 8px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {DASHBOARD_JOBS_MAP_STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-muted)' }}>{p.address}</div>
                  {dashboardJobsMapDetailLine(p) ? <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{dashboardJobsMapDetailLine(p)}</div> : null}
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <button type="button" onClick={() => onOpenJob(p)} style={POPUP_BUTTON_STYLE}>
                      Open job
                    </button>
                    <button type="button" onClick={() => onDirections(p)} style={POPUP_BUTTON_STYLE}>
                      Directions
                    </button>
                  </div>
                </div>
              </Popup>
            ) : null}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
