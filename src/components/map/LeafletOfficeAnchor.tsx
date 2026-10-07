/**
 * The office on a Leaflet map (v2.4791 — lifted out of `PinsMapCanvas` so the
 * Map page can draw it too): a diamond with a permanent label and dashed
 * rings at the anchor's distances. Behavior unchanged from the canvas.
 */
import L from 'leaflet'
import { Circle, Marker, Tooltip } from 'react-leaflet'
import { MAP_CANVAS_ANCHOR_COLOR, MAP_CANVAS_SELECTED_COLOR, METERS_PER_MILE, type MapCanvasAnchor } from '../../lib/map/mapCanvasTypes'

const ANCHOR_ICON = L.divIcon({
  className: 'pins-map-anchor',
  html: `<div style="width:12px;height:12px;transform:rotate(45deg);background:${MAP_CANVAS_ANCHOR_COLOR};border:2px solid var(--surface);box-shadow:0 0 0 1px ${MAP_CANVAS_ANCHOR_COLOR}"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

export function LeafletOfficeAnchor({ anchor }: { anchor: MapCanvasAnchor }) {
  return (
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
  )
}
