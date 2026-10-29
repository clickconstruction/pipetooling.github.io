/**
 * The site map for Materials on site (punch list #209): every pinned box as a labelled dot over
 * satellite imagery, and a placing mode that drops a box's pin where the map's ring is. Leaflet, as
 * the app's maps fall back to when no Google browser key is set; the Google canvas
 * (`PinsMapGoogleCanvas`) takes the same pins when the key exists, so the build wires the provider
 * switch the Dashboard map uses. The buttons live with the caller (a sheet's footer), so they stay
 * on screen whatever the map does with a drag or a wheel.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useState, type CSSProperties } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../../lib/materials/myLocation'

export type OnSiteMapPin = { id: string; label: string; lat: number; lng: number; tone?: 'ok' | 'amber' | 'dim' }

type Props = {
  /** The job's address, placed; the map opens here when no pin exists. */
  center: LatLng | null
  pins: OnSiteMapPin[]
  height: number | string
  onPinTap?: (id: string) => void
  /** Placing a box: the ring sits at the centre; the caller reads the centre through `onCenterChange`. */
  placing?: { label: string } | null
  /** Where the caller wants the map to go now (Use my location); a new object each time. */
  flyTo?: LatLng | null
  onCenterChange?: (c: LatLng) => void
  /** The pin to open on; it wins over `center`. */
  focusId?: string | null
}

const SATELLITE = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }
const STREETS = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
const TONE: Record<NonNullable<OnSiteMapPin['tone']>, string> = { ok: '#2563eb', amber: '#d97706', dim: '#6b7280' }
const toggle: CSSProperties = { minHeight: 32, padding: '0 0.7rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', font: 'inherit', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }

/** Leaflet measures its box once; inside a sheet that opens later, or a flex box that settles, it needs telling. */
function SizeFix() {
  const map = useMap()
  useEffect(() => {
    const ts = [50, 300, 800].map((ms) => window.setTimeout(() => map.invalidateSize(), ms))
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => map.invalidateSize()) : null
    ro?.observe(map.getContainer())
    return () => {
      ts.forEach((t) => window.clearTimeout(t))
      ro?.disconnect()
    }
  }, [map])
  return null
}

function FlyTo({ to, zoom }: { to: LatLng | null | undefined; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (to) map.setView([to.lat, to.lng], zoom)
  }, [map, to, zoom])
  return null
}

function CenterTracker({ onMove }: { onMove: (c: LatLng) => void }) {
  const map = useMapEvents({
    move: () => { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }) },
    moveend: () => { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }) },
  })
  useEffect(() => { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }) }, [map, onMove])
  return null
}

export default function OnSiteMap({ center, pins, height, onPinTap, placing, flyTo, onCenterChange, focusId }: Props) {
  const [layer, setLayer] = useState<'satellite' | 'streets'>('satellite')
  const focus = pins.find((p) => p.id === focusId) ?? null
  const first = focus ?? pins[0] ?? null
  const start = first ? { lat: first.lat, lng: first.lng } : (center ?? flyTo ?? null)
  const tiles = layer === 'satellite' ? SATELLITE : STREETS
  if (!start) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'var(--border-strong)', borderRadius: 10, color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', textAlign: 'center' }}>
        The job’s address is not on the map yet. Press Use my location to start the map where you stand.
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', height, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)' }}>
      <MapContainer center={[start.lat, start.lng]} zoom={first ? 19 : 18} maxZoom={21} style={{ width: '100%', height: '100%' }} attributionControl zoomControl>
        <TileLayer key={layer} url={tiles.url} attribution={tiles.attribution} maxNativeZoom={19} maxZoom={21} />
        <SizeFix />
        <FlyTo to={flyTo} zoom={19} />
        {placing && onCenterChange ? <CenterTracker onMove={onCenterChange} /> : null}
        {pins.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: '#ffffff', weight: 2, fillColor: TONE[p.tone ?? 'ok'], fillOpacity: 0.95 }} eventHandlers={onPinTap ? { click: () => onPinTap(p.id) } : undefined}>
            <Tooltip permanent direction="top" offset={[0, -8]} className="on-site-pin-label">{p.label}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {placing ? (
        <>
          <div aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 500 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', borderWidth: 4, borderStyle: 'solid', borderColor: '#ffffff', boxShadow: '0 0 0 3px #2563eb, 0 2px 10px rgba(0,0,0,.45)', background: 'rgba(37, 99, 235, 0.3)' }} />
            <div style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)', background: '#111827', color: '#fff', fontWeight: 800, fontSize: '0.85rem', padding: '0.1rem 0.5rem', borderRadius: 6, whiteSpace: 'nowrap' }}>{placing.label}</div>
          </div>
          <div style={{ position: 'absolute', left: 8, right: 8, top: 88, zIndex: 500, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
            <span style={{ background: 'rgba(17, 24, 39, 0.82)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.7rem', borderRadius: 999 }}>Drag the map until the ring is on {placing.label}</span>
          </div>
        </>
      ) : null}
      <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 500, display: 'flex', gap: 4 }}>
        <button type="button" style={{ ...toggle, ...(layer === 'satellite' ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setLayer('satellite')}>Satellite</button>
        <button type="button" style={{ ...toggle, ...(layer === 'streets' ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setLayer('streets')}>Streets</button>
      </div>
    </div>
  )
}
