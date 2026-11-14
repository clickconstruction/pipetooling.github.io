/**
 * The map a painted map is drawn on (punch list #345): its lines, its numbered places, and, while a
 * line is being drawn by hand, its corners and the magnifying glass. Leaflet over the view from
 * above, with a Streets switch, as the box map and the task maps draw (`OnSiteMap`).
 *
 * Drawing by hand:
 * - A press on the map adds a corner at the end of the line.
 * - A press held still, then slid, places a corner under the glass, and lifting sets it.
 * - A drag on a corner moves it, and a drag on the small dot in the middle of a leg makes a corner.
 *
 * The magnifying glass rides above a finger that is dragging. A fingertip covers fifty feet of
 * ground or more at the zoom a line is drawn at, and hides the spot it is placing. The glass is a
 * second small map two zoom steps in, centred on that spot. A mouse is already that exact, so a
 * mouse gets no glass.
 */
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { legMiddles } from '../../lib/paintedMap/draftLine'
import { PAINTED_SNAP_METERS, type NumberedPlace, type PaintedLineHow } from '../../lib/paintedMap/paintedMap'
import { PAINT_COLOR } from './paintedMapLook'
import { boundsOfPoints, lineRuns, metersPerPixel, snapTarget, type PaintedPart, type PaintedPoint, type SnapTarget } from '../../lib/paintedMap/paintedLine'

export type PaintedCanvasLine = { id: string; points: PaintedPoint[]; poorParts: ReadonlyArray<PaintedPart>; how: PaintedLineHow }

/** The line being drawn or reshaped by hand. The canvas reports each move; the caller keeps the corners. */
export type PaintedCanvasDraft = {
  points: PaintedPoint[]
  picked: number | null
  /** What a dragged corner catches: the places and the ends of the other lines. */
  targets: ReadonlyArray<SnapTarget>
  onAdd: (p: PaintedPoint) => void
  onMove: (index: number, p: PaintedPoint) => void
  onInsert: (afterIndex: number, p: PaintedPoint) => void
  onPick: (index: number | null) => void
}

/** One dot being placed or moved by hand: a place. */
export type PaintedCanvasDot = {
  point: PaintedPoint
  label: string
  targets?: ReadonlyArray<SnapTarget>
  onMove: (p: PaintedPoint) => void
}

type Props = {
  lines: ReadonlyArray<PaintedCanvasLine>
  places: ReadonlyArray<NumberedPlace>
  height: number | string
  /** Where the map opens when nothing is on it yet: the job's address, placed. */
  start?: PaintedPoint | null
  draft?: PaintedCanvasDraft | null
  dot?: PaintedCanvasDot | null
  /** Where the caller wants the map to go now (Start where I am); a new object each time. */
  flyTo?: PaintedPoint | null
  /** Where the person stands, when they asked. */
  me?: (PaintedPoint & { accuracyM: number | null }) | null
  /** Frame everything on the map again each time this number changes: a walk just ended, and the whole of it is to be looked over. */
  refit?: number
  /** Keep the person in view as they move: the map slides to them when they near its edge. For a walk being painted. */
  follow?: boolean
  onPlaceTap?: (id: string) => void
  /** A picture, not a control: no drag, no zoom, no buttons. */
  still?: boolean
  /** No tile came and one failed: the caller says so in words. Called once. */
  onTilesFailed?: () => void
  /** The middle of what the map is showing, each time it settles: where a new dot starts. */
  onView?: (center: PaintedPoint) => void
  /** What the glass is showing, for the caller's readout: the spot under the finger and what it caught. */
  onGlass?: (state: { point: PaintedPoint; caught: SnapTarget | null } | null) => void
}

// The same pictures the box map draws (`OnSiteMap`).
const SATELLITE = { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' }
const STREETS = { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }
/** The deepest zoom the pictures are taken at. Past it the map only makes the dots bigger. */
const NATIVE_ZOOM = 19
const MAX_ZOOM = 21
/** The middle of the lower 48: nobody's place, only somewhere to start a drag. */
const WIDE_START: PaintedPoint = { lat: 39.5, lng: -98.35 }

const INK = '#111827'
const PAPER = '#ffffff'
const PICKED = '#7c3aed'
const CAUGHT = '#16a34a'
const ME_BLUE = '#2563eb'

const GLASS_SIZE = 132
const GLASS_ZOOM_IN = 2
/** How long a press is held still before it becomes a placing press. */
const HOLD_MS = 380
/** A press that moves this far before then is a drag of the map. */
const HOLD_SLOP_PX = 10
/** A dragged corner catches a target this near on the screen. */
const SNAP_PX = 14

const toggle: CSSProperties = { minHeight: 32, padding: '0 0.7rem', borderRadius: 8, borderWidth: 1, borderStyle: 'solid', borderColor: 'var(--border-strong)', background: 'var(--surface)', color: 'var(--text-strong)', fontFamily: 'inherit', fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }

const ll = (p: PaintedPoint): [number, number] => [p.lat, p.lng]

// Every icon is made once and kept. react-leaflet swaps a marker's icon whenever the prop is a new object, and
// swapping the element a finger is dragging ends the drag.
function makeCornerIcon(picked: boolean): L.DivIcon {
  return L.divIcon({
    className: 'painted-map-icon',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<span style="display:block;width:18px;height:18px;margin:13px;border-radius:50%;background:${PAPER};border:3px solid ${picked ? PICKED : INK};box-shadow:0 1px 4px rgba(0,0,0,.55)"></span>`,
  })
}
const CORNER_ICON = makeCornerIcon(false)
const CORNER_PICKED_ICON = makeCornerIcon(true)
const MIDDLE_ICON = L.divIcon({
  className: 'painted-map-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  html: `<span style="display:block;width:10px;height:10px;margin:13px;border-radius:50%;background:${PAPER};opacity:.75;border:2px solid ${INK}"></span>`,
})
const placeIcons = new Map<string, L.DivIcon>()
function placeIcon(number: number, size = 26): L.DivIcon {
  const key = `${number}:${size}`
  const kept = placeIcons.get(key)
  if (kept) return kept
  const icon = makePlaceIcon(number, size)
  placeIcons.set(key, icon)
  return icon
}
function makePlaceIcon(number: number, size: number): L.DivIcon {
  return L.divIcon({
    className: 'painted-map-icon',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;box-sizing:border-box;border-radius:50%;background:${PAPER};color:${INK};border:2px solid ${INK};font:800 ${Math.round(size * 0.46)}px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.5)">${number}</span>`,
  })
}
const DOT_ICON = L.divIcon({
  className: 'painted-map-icon',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  html: `<span style="display:block;width:22px;height:22px;margin:11px;border-radius:50%;background:${ME_BLUE};border:3px solid ${PAPER};box-shadow:0 1px 5px rgba(0,0,0,.6)"></span>`,
})

/** Where the person is: smaller than the dot a finger drags, so the two are never taken for each other. */
const ME_ICON = L.divIcon({
  className: 'painted-map-icon',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<span style="display:block;width:14px;height:14px;margin:4px;border-radius:50%;background:${ME_BLUE};border:3px solid ${PAPER};box-shadow:0 0 0 1px rgba(17,24,39,.5),0 1px 4px rgba(0,0,0,.5)"></span>`,
})

/** Leaflet measures its box once; inside a window that opens later, or a flex box that settles, it needs telling. */
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

/** Frames everything again when asked: the map followed a walker to the end of the line, and Look it over wants all of it. */
function Refit({ token, points }: { token: number; points: ReadonlyArray<PaintedPoint> }) {
  const map = useMap()
  const seen = useRef(token)
  const latest = useRef(points)
  latest.current = points
  useEffect(() => {
    if (seen.current === token) return
    seen.current = token
    const b = boundsOfPoints(latest.current)
    if (!b) return
    if (b.south === b.north && b.west === b.east) map.setView([b.south, b.west], 18, { animate: false })
    else map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [40, 40], maxZoom: NATIVE_ZOOM, animate: false })
  }, [map, token])
  return null
}

/** Slides the map to the person when they walk out of the middle of it, and leaves it alone while they are in it. */
function Follow({ me }: { me: PaintedPoint }) {
  const map = useMap()
  useEffect(() => {
    const size = map.getSize()
    const at = map.latLngToContainerPoint([me.lat, me.lng])
    const margin = Math.min(size.x, size.y) * 0.25
    const inside = at.x > margin && at.x < size.x - margin && at.y > margin && at.y < size.y - margin
    if (!inside) map.panTo([me.lat, me.lng], { animate: true, duration: 0.4 })
  }, [map, me.lat, me.lng])
  return null
}

function ViewTracker({ onView }: { onView: (center: PaintedPoint) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onView({ lat: c.lat, lng: c.lng })
    },
  })
  useEffect(() => {
    const c = map.getCenter()
    onView({ lat: c.lat, lng: c.lng })
  }, [map, onView])
  return null
}

function FlyTo({ to }: { to: PaintedPoint | null | undefined }) {
  const map = useMap()
  useEffect(() => {
    if (to) map.setView([to.lat, to.lng], 18, { animate: false })
  }, [map, to])
  return null
}

/** Frames everything on the map once it knows its size. Later changes leave the view where the person put it. */
function FitOnce({ points }: { points: ReadonlyArray<PaintedPoint> }) {
  const map = useMap()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    const b = boundsOfPoints(points)
    if (!b) return
    done.current = true
    const t = window.setTimeout(() => {
      map.invalidateSize()
      if (b.south === b.north && b.west === b.east) map.setView([b.south, b.west], 18, { animate: false })
      else map.fitBounds([[b.south, b.west], [b.north, b.east]], { padding: [40, 40], maxZoom: NATIVE_ZOOM, animate: false })
    }, 60)
    return () => window.clearTimeout(t)
  }, [map, points])
  return null
}

/** The lines and the places, drawn the same on the map and in the glass. */
function Shapes({ lines, places, draftPoints, onPlaceTap, placeSize }: { lines: ReadonlyArray<PaintedCanvasLine>; places: ReadonlyArray<NumberedPlace>; draftPoints: ReadonlyArray<PaintedPoint> | null; onPlaceTap?: (id: string) => void; placeSize?: number }) {
  return (
    <>
      {lines.map((line) => {
        const runs = lineRuns(line.points, line.poorParts)
        return (
          <Fragment key={line.id}>
            {runs.sure.map((run, i) => (
              <Fragment key={`s${i}`}>
                <Polyline positions={run.map(ll)} pathOptions={{ color: INK, weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }} interactive={false} />
                <Polyline positions={run.map(ll)} pathOptions={{ color: PAINT_COLOR, weight: 5, lineJoin: 'round', lineCap: 'round', dashArray: line.how === 'drawn' ? '14 7' : undefined }} interactive={false} />
              </Fragment>
            ))}
            {/* A stretch the phone was not sure of: faint dots, never a solid line. */}
            {runs.poor.map((run, i) => (
              <Polyline key={`p${i}`} positions={run.map(ll)} pathOptions={{ color: PAINT_COLOR, weight: 4, opacity: 0.85, dashArray: '2 9', lineCap: 'round' }} interactive={false} />
            ))}
          </Fragment>
        )
      })}
      {draftPoints && draftPoints.length >= 2 ? (
        <>
          <Polyline positions={draftPoints.map(ll)} pathOptions={{ color: INK, weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }} interactive={false} />
          <Polyline positions={draftPoints.map(ll)} pathOptions={{ color: PAINT_COLOR, weight: 5, lineJoin: 'round', lineCap: 'round', dashArray: '14 7' }} interactive={false} />
        </>
      ) : null}
      {places.map((p) => (
        <Marker key={p.id} position={ll(p)} icon={placeIcon(p.number, placeSize)} interactive={!!onPlaceTap} eventHandlers={onPlaceTap ? { click: () => onPlaceTap(p.id) } : undefined} title={p.name} />
      ))}
    </>
  )
}

type Live =
  | { kind: 'move'; index: number; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'insert'; after: number; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'add'; point: PaintedPoint; caught: SnapTarget | null }
  | { kind: 'dot'; point: PaintedPoint; caught: SnapTarget | null }

/** The draft's corners with the move a finger is making right now laid over them. */
function withLive(points: ReadonlyArray<PaintedPoint>, live: Live | null): PaintedPoint[] {
  if (!live || live.kind === 'dot') return points.slice()
  if (live.kind === 'move') return points.map((p, i) => (i === live.index ? live.point : p))
  if (live.kind === 'insert') return [...points.slice(0, live.after + 1), live.point, ...points.slice(live.after + 1)]
  return [...points, live.point]
}

/** The corners, the middles of the legs and the presses that draw a line by hand. */
function DraftLayer({ draft, setLive, coarse }: { draft: PaintedCanvasDraft; setLive: (live: Live | null) => void; coarse: MutableRefObject<boolean> }) {
  const map = useMap()
  const draftRef = useRef(draft)
  draftRef.current = draft
  const quietUntil = useRef(0)

  /** Where a dragged point lands: on the target it is near on the screen, or where the finger is. */
  const settle = (p: PaintedPoint): { point: PaintedPoint; caught: SnapTarget | null } => {
    const reach = Math.min(15, Math.max(PAINTED_SNAP_METERS, SNAP_PX * metersPerPixel(map.getZoom(), p.lat)))
    const caught = snapTarget(p, draftRef.current.targets, reach)
    return { point: caught ? { lat: caught.lat, lng: caught.lng } : p, caught }
  }

  useMapEvents({
    click: (e) => {
      // The press that ended a hold, or a drag of a corner, is not also a new corner.
      if (Date.now() < quietUntil.current) return
      draftRef.current.onPick(null)
      draftRef.current.onAdd({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  // A press held still becomes a placing press: the map stops dragging, the glass shows, and lifting sets the corner.
  useEffect(() => {
    const el = map.getContainer()
    let timer = 0
    let down: { x: number; y: number; id: number } | null = null
    let holding = false
    let last: { x: number; y: number } | null = null
    const at = (x: number, y: number): PaintedPoint => {
      const r = el.getBoundingClientRect()
      const g = map.containerPointToLatLng(L.point(x - r.left, y - r.top))
      return { lat: g.lat, lng: g.lng }
    }
    const stop = () => {
      window.clearTimeout(timer)
      if (holding) map.dragging.enable()
      down = null
      holding = false
      last = null
    }
    const onDown = (e: PointerEvent) => {
      coarse.current = e.pointerType !== 'mouse'
      // A second finger is a pinch. A mouse places with a click, and has no need of the glass.
      if (down || e.pointerType === 'mouse') {
        if (down) {
          setLive(null)
          stop()
        }
        return
      }
      const target = e.target as HTMLElement | null
      if (target?.closest('.leaflet-marker-icon, .leaflet-control, button, a')) return
      down = { x: e.clientX, y: e.clientY, id: e.pointerId }
      last = { x: e.clientX, y: e.clientY }
      timer = window.setTimeout(() => {
        if (!down || !last) return
        holding = true
        map.dragging.disable()
        setLive({ kind: 'add', ...settle(at(last.x, last.y)) })
      }, HOLD_MS)
    }
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      last = { x: e.clientX, y: e.clientY }
      if (!holding) {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > HOLD_SLOP_PX) stop()
        return
      }
      e.preventDefault()
      setLive({ kind: 'add', ...settle(at(e.clientX, e.clientY)) })
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      if (holding) {
        quietUntil.current = Date.now() + 600
        const landed = settle(at(e.clientX, e.clientY))
        draftRef.current.onAdd(landed.point)
        setLive(null)
      }
      stop()
    }
    const onCancel = () => {
      setLive(null)
      stop()
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stop()
    }
    // settle reads the draft through a ref, so the listeners are set once for the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, setLive, coarse])

  // A marker's position prop must be the same array while its point is the same: react-leaflet moves a marker back
  // to its prop whenever the prop is a new object, which would pull a corner out from under the finger dragging it.
  const middlePositions = useMemo(() => legMiddles(draft.points).map(ll), [draft.points])
  const cornerPositions = useMemo(() => draft.points.map(ll), [draft.points])
  const where = (e: L.LeafletEvent): PaintedPoint => {
    const g = (e.target as L.Marker).getLatLng()
    return { lat: g.lat, lng: g.lng }
  }

  return (
    <>
      {middlePositions.map((m, i) => (
        <Marker
          key={`m${i}-${draft.points.length}`}
          position={m}
          icon={MIDDLE_ICON}
          draggable
          title="Drag to make a corner here"
          eventHandlers={{
            dragstart: (e) => setLive({ kind: 'insert', after: i, ...settle(where(e)) }),
            drag: (e) => setLive({ kind: 'insert', after: i, ...settle(where(e)) }),
            dragend: (e) => {
              quietUntil.current = Date.now() + 400
              draftRef.current.onInsert(i, settle(where(e)).point)
              setLive(null)
            },
          }}
        />
      ))}
      {cornerPositions.map((p, i) => (
        <Marker
          key={`c${i}-${draft.points.length}`}
          position={p}
          icon={draft.picked === i ? CORNER_PICKED_ICON : CORNER_ICON}
          draggable
          zIndexOffset={500}
          title="Drag to move this corner"
          eventHandlers={{
            click: () => {
              quietUntil.current = Date.now() + 400
              draftRef.current.onPick(draftRef.current.picked === i ? null : i)
            },
            dragstart: (e) => setLive({ kind: 'move', index: i, ...settle(where(e)) }),
            drag: (e) => setLive({ kind: 'move', index: i, ...settle(where(e)) }),
            dragend: (e) => {
              quietUntil.current = Date.now() + 400
              draftRef.current.onMove(i, settle(where(e)).point)
              setLive(null)
            },
          }}
        />
      ))}
    </>
  )
}

/** One dot a finger places or moves: a place. */
function DotLayer({ dot, setLive, coarse }: { dot: PaintedCanvasDot; setLive: (live: Live | null) => void; coarse: MutableRefObject<boolean> }) {
  const map = useMap()
  const dotRef = useRef(dot)
  dotRef.current = dot
  const settle = (p: PaintedPoint): { point: PaintedPoint; caught: SnapTarget | null } => {
    const reach = Math.min(15, Math.max(PAINTED_SNAP_METERS, SNAP_PX * metersPerPixel(map.getZoom(), p.lat)))
    const caught = snapTarget(p, dotRef.current.targets ?? [], reach)
    return { point: caught ? { lat: caught.lat, lng: caught.lng } : p, caught }
  }
  useEffect(() => {
    const el = map.getContainer()
    const onDown = (e: PointerEvent) => {
      coarse.current = e.pointerType !== 'mouse'
    }
    el.addEventListener('pointerdown', onDown, true)
    return () => el.removeEventListener('pointerdown', onDown, true)
  }, [map, coarse])
  useMapEvents({
    // A press on the map brings the dot there, for a dot that is a long drag away.
    click: (e) => dotRef.current.onMove({ lat: e.latlng.lat, lng: e.latlng.lng }),
  })
  const where = (e: L.LeafletEvent): PaintedPoint => {
    const g = (e.target as L.Marker).getLatLng()
    return { lat: g.lat, lng: g.lng }
  }
  // The same array while the dot is in the same spot, so a re-render mid-drag does not move it back (see DraftLayer).
  const position = useMemo(() => ll(dot.point), [dot.point])
  return (
    <Marker
      position={position}
      icon={DOT_ICON}
      draggable
      zIndexOffset={800}
      title={`Drag to place ${dot.label}`}
      eventHandlers={{
        dragstart: (e) => setLive({ kind: 'dot', ...settle(where(e)) }),
        drag: (e) => setLive({ kind: 'dot', ...settle(where(e)) }),
        dragend: (e) => {
          dotRef.current.onMove(settle(where(e)).point)
          setLive(null)
        },
      }}
    />
  )
}

/** Keeps the glass's own small map on the spot under the finger. */
function GlassFollow({ center, zoom }: { center: PaintedPoint; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], zoom, { animate: false })
  }, [map, center.lat, center.lng, zoom])
  return null
}

/** Where on the canvas the glass sits: above the finger, or to a side when the top of the map is too near. */
function GlassSpot({ live, host, children }: { live: Live; host: HTMLElement; children: (zoom: number) => ReactNode }) {
  const map = useMap()
  const size = map.getSize()
  const finger = map.latLngToContainerPoint([live.point.lat, live.point.lng])
  const half = GLASS_SIZE / 2
  const gap = 34
  let x = finger.x
  let y = finger.y - gap - half
  if (y - half < 4) {
    // No room above: the glass moves to whichever side has more of the map.
    y = Math.max(half + 4, finger.y - 10)
    x = finger.x > size.x / 2 ? finger.x - gap - half - 24 : finger.x + gap + half + 24
  }
  x = Math.min(size.x - half - 4, Math.max(half + 4, x))
  y = Math.min(size.y - half - 4, Math.max(half + 4, y))
  const zoom = Math.min(MAX_ZOOM + 1, map.getZoom() + GLASS_ZOOM_IN)
  return createPortal(
    <div
      data-painted-glass={live.caught ? 'caught' : 'open'}
      aria-hidden
      style={{ position: 'absolute', left: x - half, top: y - half, width: GLASS_SIZE, height: GLASS_SIZE, borderRadius: '50%', overflow: 'hidden', zIndex: 900, pointerEvents: 'none', borderWidth: 4, borderStyle: 'solid', borderColor: live.caught ? CAUGHT : PAPER, boxShadow: '0 6px 18px rgba(0,0,0,.5), 0 0 0 1.5px rgba(17,24,39,.7)', boxSizing: 'border-box', background: 'var(--bg-muted)' }}
    >
      {children(zoom)}
      <span style={{ zIndex: 1000, position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75, background: PAPER, opacity: 0.9, boxShadow: '0 0 0 0.5px rgba(17,24,39,.8)' }} />
      <span style={{ zIndex: 1000, position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, marginTop: -0.75, background: PAPER, opacity: 0.9, boxShadow: '0 0 0 0.5px rgba(17,24,39,.8)' }} />
      <span style={{ zIndex: 1001, position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, margin: -6, borderRadius: '50%', boxSizing: 'border-box', background: live.caught ? CAUGHT : PICKED, borderWidth: 2, borderStyle: 'solid', borderColor: PAPER }} />
    </div>,
    host,
  )
}

export default function PaintedMapCanvas({ lines, places, height, start, draft, dot, flyTo, me, follow, refit, onPlaceTap, still, onTilesFailed, onGlass, onView }: Props) {
  const [layer, setLayer] = useState<'satellite' | 'streets'>('satellite')
  const [live, setLiveState] = useState<Live | null>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const coarse = useRef(false)
  const tilesSeen = useRef({ loaded: false, told: false })
  const onGlassRef = useRef(onGlass)
  onGlassRef.current = onGlass
  const setLive = useMemo(
    () => (next: Live | null) => {
      setLiveState(next)
      onGlassRef.current?.(next ? { point: next.point, caught: next.caught } : null)
    },
    [],
  )
  const tiles = layer === 'satellite' ? SATELLITE : STREETS

  // What the first view frames: everything painted, the draft, the dot and the person, or the start, or the country.
  const framed = useMemo(() => {
    const all = [...lines.flatMap((l) => l.points), ...places, ...(draft?.points ?? []), ...(dot ? [dot.point] : [])]
    return all.length > 0 ? all : start ? [start] : []
    // The first view is framed once, from what the map opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const first = boundsOfPoints(framed)
  const centre: PaintedPoint = first ? { lat: (first.south + first.north) / 2, lng: (first.west + first.east) / 2 } : WIDE_START
  const draftShown = draft ? withLive(draft.points, live) : null
  const showGlass = !!live && !!host && coarse.current

  return (
    <div ref={setHost} data-painted-map-canvas className={layer === 'satellite' ? 'mapImagery' : undefined} style={{ position: 'relative', height, overflow: 'hidden', touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
      <MapContainer center={ll(centre)} zoom={first ? 18 : 4} maxZoom={MAX_ZOOM} style={{ width: '100%', height: '100%' }} attributionControl zoomControl={!still} dragging={!still} scrollWheelZoom={!still} doubleClickZoom={!still && !draft && !dot} touchZoom={!still} boxZoom={false} keyboard={!still}>
        <TileLayer
          key={layer}
          url={tiles.url}
          attribution={tiles.attribution}
          maxNativeZoom={NATIVE_ZOOM}
          maxZoom={MAX_ZOOM}
          eventHandlers={{
            tileload: () => {
              tilesSeen.current.loaded = true
            },
            tileerror: () => {
              if (tilesSeen.current.loaded || tilesSeen.current.told) return
              tilesSeen.current.told = true
              onTilesFailed?.()
            },
          }}
        />
        <SizeFix />
        <FitOnce points={framed} />
        <FlyTo to={flyTo} />
        {onView ? <ViewTracker onView={onView} /> : null}
        {follow && me ? <Follow me={me} /> : null}
        {refit != null ? <Refit token={refit} points={[...lines.flatMap((l) => l.points), ...places]} /> : null}
        <Shapes lines={lines} places={places} draftPoints={draftShown} onPlaceTap={draft || dot ? undefined : onPlaceTap} />
        {me ? (
          <>
            {me.accuracyM != null ? <Circle center={ll(me)} radius={me.accuracyM} pathOptions={{ color: ME_BLUE, weight: 1, fillColor: ME_BLUE, fillOpacity: 0.15 }} interactive={false} /> : null}
            <Marker position={ll(me)} icon={ME_ICON} interactive={false} title="You" />
          </>
        ) : null}
        {draft ? <DraftLayer draft={draft} setLive={setLive} coarse={coarse} /> : null}
        {dot ? <DotLayer dot={dot} setLive={setLive} coarse={coarse} /> : null}
        {showGlass && live && host ? (
          <GlassSpot live={live} host={host}>
            {(zoom) => (
              <MapContainer center={ll(live.point)} zoom={zoom} maxZoom={MAX_ZOOM + 1} style={{ width: '100%', height: '100%' }} attributionControl={false} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} boxZoom={false} keyboard={false} zoomSnap={0} fadeAnimation={false} zoomAnimation={false}>
                {/* The tiles the big map already holds, drawn larger, so the glass is never blank on a weak signal. */}
                <TileLayer url={tiles.url} maxNativeZoom={Math.min(NATIVE_ZOOM, Math.max(1, Math.floor(zoom - GLASS_ZOOM_IN)))} maxZoom={MAX_ZOOM + 1} />
                {/* And the sharper ones over them where the picture goes that deep. */}
                {zoom - GLASS_ZOOM_IN < NATIVE_ZOOM ? <TileLayer url={tiles.url} maxNativeZoom={NATIVE_ZOOM} maxZoom={MAX_ZOOM + 1} /> : null}
                <GlassFollow center={live.point} zoom={zoom} />
                <Shapes lines={lines} places={places} draftPoints={draftShown} placeSize={30} />
              </MapContainer>
            )}
          </GlassSpot>
        ) : null}
      </MapContainer>
      {still ? null : (
        <div style={{ position: 'absolute', right: 8, top: 8, zIndex: 500, display: 'flex', gap: 4 }}>
          <button type="button" aria-pressed={layer === 'satellite'} style={{ ...toggle, ...(layer === 'satellite' ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setLayer('satellite')}>
            From above
          </button>
          <button type="button" aria-pressed={layer === 'streets'} style={{ ...toggle, ...(layer === 'streets' ? { background: 'var(--text-strong)', color: 'var(--bg-page)', borderColor: 'var(--text-strong)' } : {}) }} onClick={() => setLayer('streets')}>
            Streets
          </button>
        </div>
      )}
      {live?.caught ? (
        <div role="status" data-painted-caught style={{ position: 'absolute', left: 8, right: 8, top: 48, zIndex: 600, pointerEvents: 'none', display: 'flex', justifyContent: 'center' }}>
          <span style={{ background: CAUGHT, color: PAPER, fontSize: '0.8rem', fontWeight: 700, padding: '0.3rem 0.7rem', borderRadius: 999 }}>On {live.caught.label}</span>
        </div>
      ) : null}
    </div>
  )
}
