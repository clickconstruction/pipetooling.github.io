/**
 * Leaflet pins canvas (v2.3162) — the drawing half shared by the Dashboard
 * "Your jobs on a map" card and the Bid Board "Bids on a map" card.
 *
 * Generic on purpose: a pin is an id, a position, a fill color, an optional
 * ring color (a thicker stroke — the Bid Board's due ring) and a title; the
 * caller renders the popup body for an id. An optional anchor (the office)
 * draws as a diamond with a permanent label and dashed distance rings, and is
 * included in fit-to-all. Lazy-load this file so Leaflet stays out of the
 * page bundles (the /map route chunk already carries it; Vite shares the
 * vendor chunk).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { clusterBounds, clusterLabel, clusterPins, clusterRadiusPx, type PinCluster } from '../../lib/map/clusterPins'
import { mapPulseTarget } from '../../lib/map/pulseTarget'
import { mapPointsBounds, type MapPoint } from '../../lib/map/mapPointsBounds'
import {
  MAP_CANVAS_ANCHOR_COLOR,
  MAP_CANVAS_SELECTED_COLOR,
  METERS_PER_MILE,
  mapCanvasFitPoints,
  type MapCanvasAnchor,
  type MapCanvasPin,
} from '../../lib/map/mapCanvasTypes'

export type PinsMapCanvasProps = {
  pins: MapCanvasPin[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Desktop popup body for a pin id; omitted on phones (the card renders a bar instead). */
  renderPopup?: (id: string) => ReactNode
  /** Bumped by the card's Fit all button. */
  fitSignal: number
  height: number
  /** Phone form: no popup; cooperative gestures. */
  isMobile: boolean
  anchor?: MapCanvasAnchor | null
  /** Override what fit-to-all frames (the pins + anchor by default); every pin still draws. */
  fitPoints?: readonly MapPoint[] | null
  /** v2.3213: group pins that overlap at the current zoom into count discs; click a disc to zoom to its members. */
  cluster?: boolean
  /** Ring colors most-urgent first — a cluster wears the first one any member has. */
  clusterRingPriority?: readonly string[]
  /** v2.3251: the pin (or the cluster holding it) to ring with a pulsing halo — the Bid Board's row hover. */
  pulseId?: string | null
}

/** Reports the map's zoom so the cluster grid can follow it. */
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMapEvents({ zoomend: () => onZoom(map.getZoom()) })
  useEffect(() => {
    onZoom(map.getZoom())
  }, [map, onZoom])
  return null
}

function clusterIcon(c: PinCluster<MapCanvasPin>): L.DivIcon {
  const r = clusterRadiusPx(c.count)
  const ring = c.ringColor ? `box-shadow:0 0 0 3px ${c.ringColor};` : ''
  return L.divIcon({
    className: 'pins-map-cluster',
    html: `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${c.color};opacity:.92;border:2px solid var(--surface);${ring}display:grid;place-items:center;color:#fff;font:700 ${r >= 18 ? 13 : 11}px system-ui,sans-serif;">${clusterLabel(c.count)}</div>`,
    iconSize: [r * 2, r * 2],
    iconAnchor: [r, r],
  })
}

function ClusterMarker({ cluster }: { cluster: PinCluster<MapCanvasPin> }) {
  const map = useMap()
  const icon = useMemo(() => clusterIcon(cluster), [cluster])
  return (
    <Marker
      position={[cluster.lat, cluster.lng]}
      icon={icon}
      title={`${cluster.count} bids here — click to zoom in`}
      eventHandlers={{
        click: () => {
          const b = clusterBounds(cluster)
          map.fitBounds(L.latLngBounds([b.south, b.west], [b.north, b.east]), { padding: [40, 40], maxZoom: 17 })
        },
      }}
    />
  )
}

function FitToPoints({ points, fitSignal }: { points: MapPoint[]; fitSignal: number }) {
  const map = useMap()
  const b = mapPointsBounds(points)
  const key = b ? `${b.south},${b.west},${b.north},${b.east}` : ''
  useEffect(() => {
    if (!b) return
    map.fitBounds(L.latLngBounds([b.south, b.west], [b.north, b.east]), { padding: [28, 28], maxZoom: 15 })
    // key captures the bounds; fitSignal re-fits on demand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, fitSignal])
  return null
}

const ANCHOR_ICON = L.divIcon({
  className: 'pins-map-anchor',
  html: `<div style="width:12px;height:12px;transform:rotate(45deg);background:${MAP_CANVAS_ANCHOR_COLOR};border:2px solid var(--surface);box-shadow:0 0 0 1px ${MAP_CANVAS_ANCHOR_COLOR}"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

export default function PinsMapCanvas({ pins, selectedId, onSelect, renderPopup, fitSignal, height, isMobile, anchor, fitPoints, cluster = false, clusterRingPriority, pulseId }: PinsMapCanvasProps) {
  const first = pins[0] ?? anchor ?? null
  const [zoom, setZoom] = useState(12)
  const items = useMemo(() => (cluster ? clusterPins(pins, zoom, { ringPriority: clusterRingPriority }) : null), [cluster, pins, zoom, clusterRingPriority])
  const singlePins = items ? items.flatMap((i) => (i.kind === 'pin' ? [i.pin] : [])) : pins
  const clusters = items ? items.flatMap((i) => (i.kind === 'cluster' ? [i.cluster] : [])) : []
  const pulse = mapPulseTarget(pins, items, pulseId)
  const center: L.LatLngExpression = first ? [first.lat, first.lng] : [39.5, -98.35]
  return (
    <MapContainer center={center} zoom={first ? 12 : 4} style={{ width: '100%', height }} scrollWheelZoom={!isMobile} attributionControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToPoints points={mapCanvasFitPoints(pins, anchor, fitPoints)} fitSignal={fitSignal} />
      {cluster ? <ZoomTracker onZoom={setZoom} /> : null}
      {anchor ? (
        <>
          {(anchor.ringMiles ?? []).map((mi) => (
            <Circle
              key={mi}
              center={[anchor.lat, anchor.lng]}
              radius={mi * METERS_PER_MILE}
              interactive={false}
              pathOptions={{ color: MAP_CANVAS_SELECTED_COLOR, weight: 1, opacity: 0.5, dashArray: '5 5', fillOpacity: 0 }}
            />
          ))}
          <Marker position={[anchor.lat, anchor.lng]} icon={ANCHOR_ICON} title={anchor.label} interactive={false}>
            <Tooltip permanent direction="right" offset={[8, 0]}>
              {anchor.label}
            </Tooltip>
          </Marker>
        </>
      ) : null}
      {pulse ? (
        // Keyed on the mark so a new target mounts a fresh path — Leaflet applies `className` only at creation.
        <CircleMarker
          key={`pulse-${pulse.markId}`}
          center={[pulse.lat, pulse.lng]}
          radius={pulse.radiusPx}
          interactive={false}
          pathOptions={{ className: 'pins-map-pulse-halo', color: pulse.color, weight: 3, opacity: 0.9, fillOpacity: 0 }}
        />
      ) : null}
      {clusters.map((c) => (
        <ClusterMarker key={c.id} cluster={c} />
      ))}
      {singlePins.map((p) => {
        const selected = p.id === selectedId
        const ring = p.ringColor ?? null
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lng]}
            radius={selected ? 10 : isMobile ? 9 : 8}
            pathOptions={{
              color: selected ? MAP_CANVAS_SELECTED_COLOR : (ring ?? p.color),
              fillColor: p.color,
              fillOpacity: selected ? 0.9 : 0.8,
              weight: selected ? 2 : ring ? 3 : 1,
            }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            {!isMobile && renderPopup ? <Popup>{renderPopup(p.id)}</Popup> : null}
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
