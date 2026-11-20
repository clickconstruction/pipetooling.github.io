/**
 * The site map for Materials on site (punch list #209): every pinned box as a labelled dot over
 * satellite imagery, and a placing mode that drops a box's pin where the map's ring is. Leaflet
 * alone, with no Google canvas: the pins are few and the imagery is the same. The buttons live
 * with the caller (a sheet's footer), so they stay on screen whatever the map does with a drag or
 * a wheel.
 *
 * **Time** (punch list #395): a map that is being looked at has the Time press beside Satellite and
 * Streets, and its row of dates under the map. The map is already close on the site, so Time moves
 * nothing: it swaps the photograph. It is never offered while a pin is being placed, since a pin
 * dropped on an older photograph lands where the ground no longer is, and never on a still.
 */
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { PaintedLayerMap } from '../../lib/paintedMap/paintedMapLayer'
import { PaintedMapsLayer } from '../paintedMap/PaintedMapsLayer'
import type { LatLng } from '../../lib/materials/myLocation'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useMapTime } from '../../hooks/useMapTime'
import type { MapLayerChoice } from '../../lib/map/googleMapType'
import { MAP_TIME_PINS_WORDS, MAP_TIME_SITE_NAME } from '../../lib/map/mapTime'
import { MapTimeRow } from '../map/MapTimeRow'
import { MapViewControl } from '../map/MapViewControl'

/**
 * `me` is where the person stands, when they asked (a task's place, punch list #328). `target` is the one box a
 * person is looking for and `target-old` the same box when its pin is old (Where is it?, punch list #372).
 */
export type OnSiteMapPin = { id: string; label: string; lat: number; lng: number; tone?: 'ok' | 'amber' | 'dim' | 'me' | 'target' | 'target-old' }

type Props = {
  /** The job's address, placed; the map opens here when no pin exists. */
  center: LatLng | null
  pins: OnSiteMapPin[]
  height: number | string
  onPinTap?: (id: string) => void
  /** Placing a box: the ring sits at the centre; the caller reads the centre through `onCenterChange`. */
  placing?: { label: string; /** The words under the ring's label; the box's own by default. An empty label draws no label. */ hint?: string } | null
  /** Where the caller wants the map to go now (Use my location); a new object each time. */
  flyTo?: LatLng | null
  onCenterChange?: (c: LatLng) => void
  /** The pin to open on; it wins over `center`. */
  focusId?: string | null
  /** What the frame says when there is nowhere to open the map; the job's words by default. */
  emptyWords?: string
  /** The zoom the map opens at when it opens on `center`; a property's by default. A caller with only a far-off centre opens wide. */
  startZoom?: number
  /** A picture, not a control: no drag, no zoom, no buttons. For a small map inside a list, which must not eat the page's scroll. */
  still?: boolean
  /** No tile came and one failed: the caller says so in words (a weak signal in the field). Called once. */
  onTilesFailed?: () => void
  /** The job's painted maps (#345), drawn under the pins: the way in beside what is where. A press opens the map. */
  painted?: ReadonlyArray<PaintedLayerMap>
  onPaintedTap?: (mapId: string) => void
  /**
   * The reader's own dot (Where is it?, punch list #372): drawn with the phone's margin as a ring, and a dashed
   * straight line to `lineTo`. The map fits both once, when the dot first appears, and leaves a later drag alone.
   */
  me?: { lat: number; lng: number; accuracyM: number | null } | null
  lineTo?: LatLng | null
}

const SATELLITE = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri, Vantor, Earthstar Geographics, and the GIS User Community' }
const STREETS = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
const TONE: Record<NonNullable<OnSiteMapPin['tone']>, string> = { ok: '#2563eb', amber: '#d97706', dim: '#6b7280', me: '#111827', target: '#dc2626', 'target-old': '#d97706' }

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

/**
 * Takes the map to a point, at once and with no glide (punch list #402).
 *
 * The screen around the map can change shape in the very draw that asks for this, and again when the answer to it is
 * drawn: a tall line under a press comes or goes. So the map measures its box first. A point worked out from the old
 * box is the old middle. And it does not glide: a resize cannot correct a glide already under way, and one that came
 * mid-glide left the ring off the point by half of what the box had grown, with the sheet saying the ring was moved
 * by hand.
 */
function FlyTo({ to, zoom }: { to: LatLng | null | undefined; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    if (!to) return
    map.invalidateSize({ animate: false })
    map.setView([to.lat, to.lng], zoom, { animate: false })
  }, [map, to, zoom])
  return null
}

/** The reader and the pin in one view, once: the first time the dot appears. A drag after that is the reader's own. */
function FitMe({ me, to }: { me: LatLng | null; to: LatLng | null }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (!me) { done.current = false; return }
    if (done.current) return
    done.current = true
    if (to) map.fitBounds([[me.lat, me.lng], [to.lat, to.lng]], { padding: [36, 36], maxZoom: 19 })
    else map.setView([me.lat, me.lng], 18)
  }, [map, me, to])
  return null
}

/**
 * Says where the ring is each time the map moves. It listens with one set of handlers for the life of the map. A new
 * set each draw is taken off and put back by an effect, and `FlyTo`'s effect runs in between: a fly that lands at once
 * was then heard by nobody, and the sheet went on believing the ring was where it had been (punch list #402).
 */
function CenterTracker({ onMove }: { onMove: (c: LatLng) => void }) {
  const map = useMap()
  const latest = useRef(onMove)
  latest.current = onMove
  const handlers = useMemo(() => {
    const say = () => {
      const c = map.getCenter()
      latest.current({ lat: c.lat, lng: c.lng })
    }
    return { move: say, moveend: say }
  }, [map])
  useMapEvents(handlers)
  useEffect(() => { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }) }, [map, onMove])
  return null
}

export default function OnSiteMap({ center, pins, height, onPinTap, placing, flyTo, onCenterChange, focusId, emptyWords, startZoom, still, onTilesFailed, painted, onPaintedTap, me, lineTo }: Props) {
  const isMobile = useIsMobile()
  const [layer, setLayer] = useState<MapLayerChoice>('satellite')
  const tilesSeen = useRef({ loaded: false, told: false })
  const focus = pins.find((p) => p.id === focusId) ?? null
  const first = focus ?? pins[0] ?? null
  // With no pin and no address on the map, a painted line still says where the job is.
  const paintedStart = painted?.[0]?.lines[0]?.points[0] ?? painted?.[0]?.places[0] ?? null
  const start = first ? { lat: first.lat, lng: first.lng } : (center ?? flyTo ?? (paintedStart ? { lat: paintedStart.lat, lng: paintedStart.lng } : null))
  // Time looks at the site: the pin the map opened on, or else where the map opened. Only a map that is being looked at has it.
  const canTime = !still && !placing
  const spotLat = canTime ? (start?.lat ?? null) : null
  const spotLng = canTime ? (start?.lng ?? null) : null
  const time = useMapTime(useMemo(() => (spotLat == null || spotLng == null ? null : { lat: spotLat, lng: spotLng, name: MAP_TIME_SITE_NAME }), [spotLat, spotLng]))
  const { on: timeOn, off: timeOff } = time
  // Placing begins while Time is on: the map goes back to today before a pin can be dropped.
  useEffect(() => {
    if (!canTime && timeOn) timeOff()
  }, [canTime, timeOn, timeOff])
  const inTime = canTime && timeOn
  const shownLayer: MapLayerChoice = inTime ? 'satellite' : layer
  const tiles = inTime && time.imagery ? time.imagery : shownLayer === 'satellite' ? SATELLITE : STREETS
  const pickLayer = (next: MapLayerChoice) => {
    timeOff()
    setLayer(next)
  }
  // A height in words fills its parent, so the row takes its room from the map. A height in pixels is the map's own, and the row adds to it.
  const fills = typeof height !== 'number'
  if (!start) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderColor: 'var(--border-strong)', borderRadius: 10, color: 'var(--text-muted)', fontSize: '0.9rem', padding: '1rem', textAlign: 'center' }}>
        {emptyWords ?? 'The job’s address is not on the map yet. Press Use my location to start the map where you stand.'}
      </div>
    )
  }
  return (
    <div data-on-site-map style={{ borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border)', ...(fills ? { height, display: 'flex', flexDirection: 'column' } : {}) }}>
    <div data-map-provider={inTime ? 'archive' : 'osm'} className={shownLayer === 'satellite' ? 'mapImagery' : undefined} style={{ position: 'relative', isolation: 'isolate', overflow: 'hidden', ...(fills ? { flex: '1 1 0', minHeight: 0 } : { height }) }}>
      <MapContainer center={[start.lat, start.lng]} zoom={first ? 19 : (startZoom ?? 18)} maxZoom={21} style={{ width: '100%', height: '100%' }} attributionControl zoomControl={!still} dragging={!still} scrollWheelZoom={!still} doubleClickZoom={!still} touchZoom={!still} boxZoom={!still} keyboard={!still}>
        <TileLayer
          // Keyed by its address: a new date is a new layer, and the old tiles do not linger under it.
          key={tiles.url}
          url={tiles.url}
          attribution={tiles.attribution}
          maxNativeZoom={19}
          maxZoom={21}
          eventHandlers={{
            tileload: () => { tilesSeen.current.loaded = true },
            tileerror: () => {
              if (tilesSeen.current.loaded || tilesSeen.current.told) return
              tilesSeen.current.told = true
              onTilesFailed?.()
            },
          }}
        />
        <SizeFix />
        <FlyTo to={flyTo} zoom={19} />
        {placing && onCenterChange ? <CenterTracker onMove={onCenterChange} /> : null}
        {painted && painted.length > 0 ? <PaintedMapsLayer maps={painted} onOpen={still ? undefined : onPaintedTap} quiet /> : null}
        <FitMe me={me ?? null} to={lineTo ?? null} />
        {/* Leaflet writes these as SVG attributes, which read no CSS variable: the map's own blue, as a pin's. */}
        {me && lineTo ? <Polyline positions={[[me.lat, me.lng], [lineTo.lat, lineTo.lng]]} pathOptions={{ color: TONE.ok, weight: 3, dashArray: '8 7', opacity: 0.9 }} interactive={false} /> : null}
        {me && me.accuracyM != null && me.accuracyM > 0 ? <Circle center={[me.lat, me.lng]} radius={me.accuracyM} pathOptions={{ color: TONE.ok, weight: 1, fillColor: TONE.ok, fillOpacity: 0.16 }} interactive={false} /> : null}
        {me ? <CircleMarker center={[me.lat, me.lng]} radius={7} pathOptions={{ color: '#ffffff', weight: 2, fillColor: TONE.ok, fillOpacity: 1 }} interactive={false} /> : null}
        {pins.map((p) => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={p.tone === 'dim' ? 7 : 9} pathOptions={{ color: '#ffffff', weight: 2, fillColor: TONE[p.tone ?? 'ok'], fillOpacity: p.tone === 'dim' ? 0.6 : 0.95 }} eventHandlers={onPinTap ? { click: () => onPinTap(p.id) } : undefined}>
            <Tooltip permanent direction="top" offset={[0, -8]} className="on-site-pin-label">{p.label}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {placing ? (
        <>
          <div aria-hidden style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 500 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', borderWidth: 4, borderStyle: 'solid', borderColor: '#ffffff', boxShadow: '0 0 0 3px #2563eb, 0 2px 10px rgba(0,0,0,.45)', background: 'rgba(37, 99, 235, 0.3)' }} />
            {placing.label ? <div style={{ position: 'absolute', left: '50%', top: -34, transform: 'translateX(-50%)', background: '#111827', color: '#fff', fontWeight: 800, fontSize: '0.85rem', padding: '0.1rem 0.5rem', borderRadius: 6, whiteSpace: 'nowrap' }}>{placing.label}</div> : null}
          </div>
          <div style={{ position: 'absolute', left: 8, right: 8, top: 88, zIndex: 500, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
            <span style={{ background: 'rgba(17, 24, 39, 0.82)', color: '#fff', fontSize: '0.8rem', fontWeight: 600, padding: '0.35rem 0.7rem', borderRadius: 999 }}>{placing.hint ?? `Drag the map until the ring is on ${placing.label}`}</span>
          </div>
        </>
      ) : null}
      {still ? null : <MapViewControl layer={layer} onLayer={pickLayer} time={canTime ? time : null} isMobile={isMobile} />}
    </div>
    {canTime ? <MapTimeRow time={time} isMobile={isMobile} surface="on-site-map" dotsWords={MAP_TIME_PINS_WORDS} /> : null}
    </div>
  )
}
