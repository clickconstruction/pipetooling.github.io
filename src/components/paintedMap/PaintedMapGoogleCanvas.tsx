/**
 * A painted map on a Google map (punch list #387): its lines, its numbered places and the person's
 * own dot, over Google's photograph or its road map. It is read on it, and since step 3 a walk is
 * painted on it, a place's dot is put down on it and a line is drawn on it by hand. While Time is
 * on, and while a picture of the map is up, the Leaflet canvas is the map (`paintedMapProvider.ts`),
 * and `PaintedMapCanvas` mounts one or the other.
 *
 * - **Lines** are Google's own lines, stroked as the Leaflet canvas strokes them
 *   (`paintedGoogleShapes.ts`): a dark edge under the paint, dashes for a line drawn by hand, faint
 *   dots for a stretch the phone was not sure of.
 * - **Places and the person's dot** are small pieces of HTML held on their spot. Google's own marker
 *   draws HTML only on a map with a Map ID, which is a setting in Google's console the app does not
 *   have, so these ride in an overlay and wear the very marks the Leaflet canvas draws.
 * - **A rough reading** (punch list #402) is drawn as its whole area, dashed and with no dot, and with
 *   `frameMargin` the view is moved by the one rule the Leaflet canvas asks, `marginFrame.ts`.
 * - **The view** is worked out here and not by Google's fit (`paintedMapView.ts`), so a short line
 *   opens no closer than its photograph is sharp, and a view carried from the other canvas is kept.
 * - **A walk** (step 3): the line being painted grows with each reading, and only the line that
 *   changed is drawn again. `follow` slides the map to the walker when they near its edge, by the
 *   Leaflet canvas's own rule (`followMe.ts`).
 * - **A dot placed by hand** (step 3): one of Google's own markers, wearing the Leaflet canvas's dot,
 *   that a finger drags. A press on the map brings it there, and a target it nears catches it, by
 *   the rules both canvases read (`handPlacing.ts`).
 * - **A line drawn by hand** (step 3): a press adds a corner, a press held still then slid places one
 *   under the glass, a drag on a corner moves it, and a drag on the dot in the middle of a leg makes
 *   one. The corners are Google's own markers too, and the line in hand is one pair of lines that is
 *   moved and never remade.
 * - **The glass** rides above a finger that is placing. Its picture is a second small Google map,
 *   made once for the page and kept. It is asked for the glass's own view, two zoom steps in. Google
 *   gives a zoom no deeper than its photograph goes at the spot, and the glass draws the picture
 *   larger only by the steps Google held back. The lines and places in it are drawn here, sharp.
 * - **A reader and the line together** (`frameMe`, step 4): on the public page a reader who asked to
 *   be shown is framed with the whole map, by the Leaflet canvas's own rule (`frameMe.ts`).
 * - **A light page.** The public page is light whatever the app's theme, so `light` holds Google's
 *   map and its buttons light too.
 * - **One map, kept.** Google bills by the map made. `reuseMaps` puts the map away when this canvas
 *   leaves and brings the same one back, so going to Time and back, or closing a painted map and
 *   opening another, makes no new one for as long as the page is open.
 * - **The wait.** While Google's script is on its way the lines and the places are drawn at once as a plain drawing,
 *   on the pixels the map will put them (`PaintedWaitSketch`), so a reader on a weak signal is not left with words alone.
 *
 * Its doors to Leaflet are the pins canvas's own (`useGoogleCanvasDoors`). Lazy-load this file: it
 * pulls in the Maps library.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import { useGoogleCanvasDoors, useStampedTheme } from '../../hooks/useGoogleCanvasDoors'
import { googleColorSchemeForTheme } from '../../lib/dashboardJobsMap'
import { GOOGLE_MAP_STYLES } from '../../lib/map/googleMapLook'
import { googleMapTypeIsImagery, type GoogleMapTypeId } from '../../lib/map/googleMapType'
import { followStep, pointInBox } from '../../lib/paintedMap/followMe'
import { legMiddles } from '../../lib/paintedMap/draftLine'
import { frameMeStep } from '../../lib/paintedMap/frameMe'
import { GLASS_ASK_AGAIN_MS, GLASS_SIZE, HOLD_MS, HOLD_SLOP_PX, glassPictureScale, glassSpot, glassView, settlePoint, spotAtBox, withLive, type PaintedLive } from '../../lib/paintedMap/handPlacing'
import { MARGIN_FRAME_PADDING_PX, marginFrameStep, type MarginFramed, type PaintedCanvasMe } from '../../lib/paintedMap/marginFrame'
import { areaEdgeStroke, circleRing, poorRunStroke, sureRunStrokes, type GoogleLineStroke } from '../../lib/paintedMap/paintedGoogleShapes'
import { lineRuns, type PaintedPoint, type SnapTarget } from '../../lib/paintedMap/paintedLine'
import { PAINTED_POINT_ZOOM, paintedFitView, paintedOpeningView, paintedViewBounds, type PaintedMapView } from '../../lib/paintedMap/paintedMapView'
import { placeMarkHtml, placeMarkSize, placeSaysWords } from '../../lib/paintedMap/paintedPlaceKind'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GoogleCanvasBoundary } from '../map/GoogleCanvasBoundary'
import { GLASS_MAP_PX, keptPaintedGlassMap, paintedGlassMap } from './paintedGoogleGlassMap'
import type { PaintedCanvasDot, PaintedCanvasDraft, PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import { PAINT_COLOR, PAINT_INK, PAINT_ME_BLUE, PAINT_PAPER } from './paintedMapLook'
import { PaintedWaitSketch } from './PaintedWaitSketch'

export type PaintedMapGoogleCanvasProps = {
  apiKey: string
  /** Google could not be used on this page: the caller draws on Leaflet from here on. */
  onUnavailable: (reason: string) => void
  /** Google's photograph with street names, or its road map. */
  mapTypeId: GoogleMapTypeId
  lines: ReadonlyArray<PaintedCanvasLine>
  places: ReadonlyArray<PaintedCanvasPlace>
  /** What the first view frames. The caller decides it once, as it does for the Leaflet canvas. */
  framed: ReadonlyArray<PaintedPoint>
  /** Where the map opens when nothing is on it yet. */
  start?: PaintedPoint | null
  /** The view the other canvas was on. It wins over `framed`, so a change of map keeps the painter's spot. */
  openOn?: PaintedMapView | null
  /** Where the caller wants the map to go now. A new object each time. */
  flyTo?: PaintedPoint | null
  /** Where the person stands, when they asked. Marked `area`, it is a rough reading: its whole circle, dashed, with no dot. */
  me?: PaintedCanvasMe | null
  /** Frame by how sure the phone is (`marginFrame.ts`), as the Leaflet canvas does. */
  frameMargin?: boolean
  /** Keep the person in view as they move (`followMe.ts`): for a walk being painted. Never for an area. */
  follow?: boolean
  /** Keep the person and the whole map in the picture together (`frameMe.ts`): for a reader finding the line. Never for an area. */
  frameMe?: boolean
  /** The screen is light whatever the app's theme (the public page): Google's map is light too. */
  light?: boolean
  /** Frame everything on the map again each time this number changes. */
  refit?: number
  onPlaceTap?: (id: string) => void
  /** The line being drawn or reshaped by hand. The canvas reports each move, and the caller keeps the corners. */
  draft?: PaintedCanvasDraft | null
  /** One dot being placed or moved by hand: a place. */
  dot?: PaintedCanvasDot | null
  /** What a finger is doing right now, for the caller's words: the spot and what it caught. Null when it lifts. */
  onLive?: (live: PaintedLive | null) => void
  /** The middle of what the map is showing, each time it settles. */
  onView?: (center: PaintedPoint) => void
  /** The whole view each time it settles, for the caller to hand to the other canvas. */
  onCamera?: (view: PaintedMapView) => void
}

const LOOK = { ink: PAINT_INK, paint: PAINT_COLOR }
/** What the frame says while Google's script is on its way. The window's own words for a map that is not up yet. */
export const PAINTED_GOOGLE_LOADING_WORDS = 'Loading the map…'
const PLACE_SIZE = 26
/** The person's dot, as the Leaflet canvas draws it: smaller than the dot a finger drags. */
const ME_BOX = 22
/** The glass's ring when it has caught a target, and its middle dot when it has not: the Leaflet canvas's own. */
const GLASS_CAUGHT = '#16a34a'
const GLASS_PICKED = '#7c3aed'
/** A place in the glass, a size up, as the Leaflet canvas draws it there. */
const GLASS_PLACE_SIZE = 30
const ME_HTML = `<span style="display:block;width:14px;height:14px;margin:4px;border-radius:50%;background:${PAINT_ME_BLUE};border:3px solid ${PAINT_PAPER};box-shadow:0 0 0 1px rgba(17,24,39,.5),0 1px 4px rgba(0,0,0,.5)"></span>`

type Mark = { lat: number; lng: number; html: string; box: number; kind: 'place' | 'me'; title?: string; onTap?: () => void }

/** One piece of HTML held on a spot of the map, its middle on the spot. A press on a place reaches the caller and not the map. */
function addMark(map: google.maps.Map, mark: Mark): google.maps.OverlayView {
  const view = new google.maps.OverlayView()
  let el: HTMLDivElement | null = null
  view.onAdd = () => {
    el = document.createElement('div')
    el.dataset.paintedMark = mark.kind
    el.style.cssText = `position:absolute;width:${mark.box}px;height:${mark.box}px;${mark.onTap ? 'cursor:pointer' : 'pointer-events:none'}`
    el.innerHTML = mark.html
    if (mark.title) el.title = mark.title
    const { onTap } = mark
    if (onTap) {
      el.setAttribute('role', 'button')
      el.tabIndex = 0
      if (mark.title) el.setAttribute('aria-label', mark.title)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        onTap()
      })
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onTap()
      })
      google.maps.OverlayView.preventMapHitsFrom(el)
    }
    const panes = view.getPanes()
    ;(onTap ? panes?.overlayMouseTarget : panes?.markerLayer)?.appendChild(el)
  }
  view.draw = () => {
    const at = view.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(mark.lat, mark.lng))
    if (!el || !at) return
    el.style.left = `${Math.round(at.x - mark.box / 2)}px`
    el.style.top = `${Math.round(at.y - mark.box / 2)}px`
  }
  view.onRemove = () => {
    el?.remove()
    el = null
  }
  view.setMap(map)
  return view
}

/** One line as Google's own lines: a dark edge under the paint for each sure run, faint dots for each unsure one. */
function strokeLine(map: google.maps.Map, line: PaintedCanvasLine): google.maps.Polyline[] {
  const made: google.maps.Polyline[] = []
  const stroke = (run: ReadonlyArray<PaintedPoint>, look: GoogleLineStroke) => {
    made.push(new google.maps.Polyline({ map, path: run.map((p) => ({ lat: p.lat, lng: p.lng })), clickable: false, ...look }))
  }
  const runs = lineRuns(line.points, line.poorParts)
  for (const run of runs.sure) for (const look of sureRunStrokes(line.how, LOOK)) stroke(run, look)
  for (const run of runs.poor) stroke(run, poorRunStroke(LOOK))
  return made
}

/** The same things in the same order: the caller builds a new list on each reading of a walk, around the same points. */
function sameItems<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean {
  return a === b || (a.length === b.length && a.every((item, i) => item === b[i]))
}

/**
 * The lines. Each is drawn once and kept while it is the same line: a walk hands a new list on every reading, and only
 * the line that grew is drawn again. The saved lines beside it are left as they are.
 */
function Lines({ lines }: { lines: ReadonlyArray<PaintedCanvasLine> }) {
  const map = useMap()
  const drawn = useRef(new Map<string, { line: PaintedCanvasLine; shapes: google.maps.Polyline[] }>())
  useEffect(() => {
    if (!map) return
    const kept = drawn.current
    const now = new Set<string>()
    for (const line of lines) {
      now.add(line.id)
      const was = kept.get(line.id)
      if (was && was.line.how === line.how && sameItems(was.line.points, line.points) && sameItems(was.line.poorParts, line.poorParts)) continue
      was?.shapes.forEach((s) => s.setMap(null))
      kept.set(line.id, { line, shapes: strokeLine(map, line) })
    }
    for (const [id, was] of kept) {
      if (now.has(id)) continue
      was.shapes.forEach((s) => s.setMap(null))
      kept.delete(id)
    }
  }, [map, lines])
  // Everything comes off when the canvas leaves, or when the map under it is another one.
  useEffect(() => {
    const kept = drawn.current
    return () => {
      for (const was of kept.values()) was.shapes.forEach((s) => s.setMap(null))
      kept.clear()
    }
  }, [map])
  return null
}

/** The numbered places, each wearing its number or its letter, and its kind's mark when it has one. */
function Places({ places, onPlaceTap }: { places: ReadonlyArray<PaintedCanvasPlace>; onPlaceTap?: (id: string) => void }) {
  const map = useMap()
  // The caller's press may be a new function each render. The marks are made once for a list of places and read it here.
  const tap = useRef(onPlaceTap)
  tap.current = onPlaceTap
  const tappable = !!onPlaceTap
  useEffect(() => {
    if (!map) return
    const made = places.map((p) =>
      addMark(map, {
        kind: 'place',
        lat: p.lat,
        lng: p.lng,
        box: placeMarkSize(p.kind, PLACE_SIZE),
        html: placeMarkHtml({ number: p.letter ?? p.number, kind: p.kind }, { size: PLACE_SIZE, ink: PAINT_INK, paper: PAINT_PAPER, shadow: true, dashed: p.fromJob === true }),
        title: placeSaysWords(p),
        ...(tappable ? { onTap: () => tap.current?.(p.id) } : {}),
      }),
    )
    return () => made.forEach((m) => m.setMap(null))
  }, [map, places, tappable])
  return null
}

/**
 * Where the person is, with the ring of how sure the phone was. A rough reading that has stayed rough is an area and
 * not a spot (punch list #402): the whole circle with a dashed edge, a little more fill, and no dot in its middle.
 */
function Me({ me }: { me: PaintedCanvasMe }) {
  const map = useMap()
  const { lat, lng, accuracyM } = me
  const area = me.area === true
  useEffect(() => {
    if (!map) return
    const made: Array<{ setMap: (map: google.maps.Map | null) => void }> = []
    if (accuracyM != null) {
      // Google's circle has no dashed edge, so an area's edge is a dashed line run round it over a circle that is fill alone.
      made.push(new google.maps.Circle({ map, center: { lat, lng }, radius: accuracyM, clickable: false, strokeColor: PAINT_ME_BLUE, strokeOpacity: area ? 0 : 1, strokeWeight: 1, fillColor: PAINT_ME_BLUE, fillOpacity: area ? 0.18 : 0.15 }))
      if (area) made.push(new google.maps.Polyline({ map, path: circleRing({ lat, lng }, accuracyM), clickable: false, ...areaEdgeStroke(PAINT_ME_BLUE) }))
    }
    if (!area) made.push(addMark(map, { kind: 'me', lat, lng, box: ME_BOX, html: ME_HTML }))
    return () => made.forEach((m) => m.setMap(null))
  }, [map, lat, lng, accuracyM, area])
  return null
}

/**
 * Frames by how sure the phone is (punch list #402). The rule is `marginFrame.ts`, asked on each new reading exactly as
 * the Leaflet canvas asks it. It stays mounted across the wait, when there is no `me`, so it remembers an area came before.
 */
function FrameMargin({ me, points }: { me: PaintedCanvasMe | null; points: ReadonlyArray<PaintedPoint> }) {
  const map = useMap()
  const framed = useRef<MarginFramed>('none')
  const latest = useRef(points)
  latest.current = points
  const lat = me?.lat ?? null
  const lng = me?.lng ?? null
  const accuracyM = me?.accuracyM ?? null
  const area = me?.area === true
  useEffect(() => {
    if (!map || lat == null || lng == null) return
    // Measure first, as the Leaflet canvas does (v2.8001). The panel beside the map can change height in the very draw
    // that hands in an area, and Google hears of a new size only later. So what the map shows is worked out from the
    // box as it is now, and the circle is fitted to that box, never to the one the map last measured.
    const div = map.getDiv()
    const boxNow = { width: div.clientWidth, height: div.clientHeight }
    const c = map.getCenter()
    const z = map.getZoom()
    const step = marginFrameStep({
      framed: framed.current,
      me: { lat, lng, accuracyM, area },
      points: latest.current,
      zoom: z ?? null,
      // A map that has not settled cannot say what it shows. The rule takes that as it is.
      view: c && z != null && boxNow.width > 0 && boxNow.height > 0 ? paintedViewBounds({ center: { lat: c.lat(), lng: c.lng() }, zoom: z }, boxNow) : null,
    })
    framed.current = step.framed
    if (step.move?.kind === 'area') {
      const { box } = step.move
      const view = paintedFitView([{ lat: box.south, lng: box.west }, { lat: box.north, lng: box.east }], boxNow, MARGIN_FRAME_PADDING_PX)
      if (view) map.moveCamera(view)
    } else if (step.move?.kind === 'person') {
      map.moveCamera({ center: { lat: step.move.at.lat, lng: step.move.at.lng }, zoom: step.move.zoom })
    }
  }, [map, lat, lng, accuracyM, area])
  return null
}

/** The dot a finger places: the Leaflet canvas's own, as a picture Google's marker can wear, in a box a fingertip can find. */
const DOT_BOX = 44
const DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${DOT_BOX}" height="${DOT_BOX}"><circle cx="22" cy="23" r="12" fill="rgba(0,0,0,.4)"/><circle cx="22" cy="22" r="9.5" fill="${PAINT_ME_BLUE}" stroke="${PAINT_PAPER}" stroke-width="3"/></svg>`
/** A drawing as a marker's icon, its middle on the spot. Google's own marker takes HTML only with a Map ID, and takes a picture without one. */
function svgIcon(svg: string, box: number): google.maps.Icon {
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size: new google.maps.Size(box, box), scaledSize: new google.maps.Size(box, box), anchor: new google.maps.Point(box / 2, box / 2) }
}

/** Where the map is looking and how big its box is now, or null for a map that has not settled. */
function readView(map: google.maps.Map): { view: PaintedMapView; box: { width: number; height: number } } | null {
  const c = map.getCenter()
  const z = map.getZoom()
  const div = map.getDiv()
  if (!c || z == null) return null
  return { view: { center: { lat: c.lat(), lng: c.lng() }, zoom: z }, box: { width: div.clientWidth, height: div.clientHeight } }
}

/** A corner of the line being drawn, and the small dot in the middle of a leg: the Leaflet canvas's own, as pictures in boxes a fingertip can find. */
const CORNER_BOX = 44
const cornerSvg = (picked: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CORNER_BOX}" height="${CORNER_BOX}"><circle cx="22" cy="23" r="10" fill="rgba(0,0,0,.4)"/><circle cx="22" cy="22" r="7.5" fill="${PAINT_PAPER}" stroke="${picked ? GLASS_PICKED : PAINT_INK}" stroke-width="3"/></svg>`
const MIDDLE_BOX = 36
const MIDDLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${MIDDLE_BOX}" height="${MIDDLE_BOX}"><circle cx="18" cy="18" r="4" fill="${PAINT_PAPER}" fill-opacity=".75" stroke="${PAINT_INK}" stroke-width="2"/></svg>`
/** What a press on the map is not a press on the ground for: one of Google's markers or buttons, or a mark of ours. */
const NOT_THE_GROUND = '[title], [role="button"], button, a, .gmnoprint'

/** The spot an event of Google's own happened on. */
function eventSpot(e: google.maps.MapMouseEvent): PaintedPoint | null {
  return e.latLng ? { lat: e.latLng.lat(), lng: e.latLng.lng() } : null
}

/** The line being drawn, with the move a finger is making laid over it: one pair of Google's lines, moved and never remade. */
function DraftLine({ points }: { points: ReadonlyArray<PaintedPoint> }) {
  const map = useMap()
  const pair = useRef<google.maps.Polyline[]>([])
  useEffect(() => {
    if (!map) return
    // Over the saved lines, so the line in hand is never under one it crosses.
    pair.current = sureRunStrokes('drawn', LOOK).map((look) => new google.maps.Polyline({ map, path: [], clickable: false, ...look, zIndex: look.zIndex + 10 }))
    return () => {
      pair.current.forEach((l) => l.setMap(null))
      pair.current = []
    }
  }, [map])
  useEffect(() => {
    // One corner is not a line yet.
    const path = points.length >= 2 ? points.map((p) => ({ lat: p.lat, lng: p.lng })) : []
    pair.current.forEach((l) => l.setPath(path))
  }, [map, points])
  return null
}

/**
 * The corners, the middles of the legs and the presses that draw a line by hand, as the Leaflet canvas takes them:
 * a press adds a corner, a press held still then slid places one under the glass, a drag on a corner moves it, and a
 * drag on the dot in the middle of a leg makes a corner there.
 */
function DraftLayer({ draft, setLive, coarse }: { draft: PaintedCanvasDraft; setLive: (live: PaintedLive | null) => void; coarse: MutableRefObject<boolean> }) {
  const map = useMap()
  const draftRef = useRef(draft)
  draftRef.current = draft
  // The press that ended a hold, or a drag of a corner, is not also a new corner.
  const quietUntil = useRef(0)
  // A press Google gave to a corner or a middle dot is that marker's: it ends any hold the same press began.
  const endHold = useRef<() => void>(() => {})

  useEffect(() => {
    if (!map) return
    const settle = (p: PaintedPoint) => settlePoint(p, draftRef.current.targets, map.getZoom() ?? PAINTED_POINT_ZOOM)
    const click = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      const p = eventSpot(e)
      if (!p || Date.now() < quietUntil.current) return
      draftRef.current.onPick(null)
      draftRef.current.onAdd(p)
    })
    // A press held still becomes a placing press: the map stops moving under the finger, the glass shows, and lifting sets the corner.
    const el = map.getDiv()
    let timer = 0
    let down: { x: number; y: number; id: number } | null = null
    let holding = false
    let last: { x: number; y: number } | null = null
    const at = (x: number, y: number): PaintedPoint | null => {
      const seen = readView(map)
      if (!seen) return null
      const r = el.getBoundingClientRect()
      return spotAtBox({ x: x - r.left, y: y - r.top }, seen.view, seen.box)
    }
    const show = (x: number, y: number) => {
      const p = at(x, y)
      if (p) setLive({ kind: 'add', ...settle(p) })
    }
    const stop = () => {
      window.clearTimeout(timer)
      if (holding) {
        map.setOptions({ gestureHandling: 'greedy' })
        // However the hold ends, the press that made it is not also a press on the map.
        quietUntil.current = Date.now() + 600
      }
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
      if ((e.target as HTMLElement | null)?.closest?.(NOT_THE_GROUND)) return
      down = { x: e.clientX, y: e.clientY, id: e.pointerId }
      last = { x: e.clientX, y: e.clientY }
      timer = window.setTimeout(() => {
        if (!down || !last) return
        holding = true
        // Quiet from here, not from the lift: Google may say the map was pressed before this canvas hears the finger lift.
        quietUntil.current = Number.POSITIVE_INFINITY
        map.setOptions({ gestureHandling: 'none' })
        show(last.x, last.y)
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
      show(e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return
      if (holding) {
        const p = at(e.clientX, e.clientY)
        if (p) draftRef.current.onAdd(settle(p).point)
        setLive(null)
      }
      stop()
    }
    const onCancel = () => {
      setLive(null)
      stop()
    }
    endHold.current = () => {
      if (!down) return
      if (holding) setLive(null)
      stop()
    }
    el.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      endHold.current = () => {}
      // A drawing that ends with a finger still down leaves no glass up and no words about a catch.
      setLive(null)
      google.maps.event.removeListener(click)
      el.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      stop()
    }
  }, [map, setLive, coarse])

  // The corners and the middles are made again whenever the line changes. It changes when a finger lifts, never while one drags.
  const { points, picked } = draft
  useEffect(() => {
    if (!map) return
    const settle = (p: PaintedPoint) => settlePoint(p, draftRef.current.targets, map.getZoom() ?? PAINTED_POINT_ZOOM)
    const made: google.maps.Marker[] = []
    const listeners: google.maps.MapsEventListener[] = []
    const drags = (m: google.maps.Marker, live: (landed: { point: PaintedPoint; caught: SnapTarget | null }) => PaintedLive, done: (p: PaintedPoint) => void) => {
      const say = (e: google.maps.MapMouseEvent) => {
        const p = eventSpot(e)
        if (p) setLive(live(settle(p)))
      }
      listeners.push(
        m.addListener('dragstart', (e: google.maps.MapMouseEvent) => {
          endHold.current()
          say(e)
        }),
        m.addListener('drag', say),
        m.addListener('dragend', (e: google.maps.MapMouseEvent) => {
          quietUntil.current = Date.now() + 400
          const p = eventSpot(e)
          if (p) done(settle(p).point)
          setLive(null)
        }),
      )
    }
    legMiddles(points).forEach((mid, i) => {
      const m = new google.maps.Marker({ map, position: { lat: mid.lat, lng: mid.lng }, draggable: true, icon: svgIcon(MIDDLE_SVG, MIDDLE_BOX), zIndex: 400, title: 'Drag to make a corner here', crossOnDrag: false, optimized: false })
      made.push(m)
      drags(m, (landed) => ({ kind: 'insert', after: i, ...landed }), (p) => draftRef.current.onInsert(i, p))
    })
    points.forEach((corner, i) => {
      const m = new google.maps.Marker({ map, position: { lat: corner.lat, lng: corner.lng }, draggable: true, icon: svgIcon(cornerSvg(picked === i), CORNER_BOX), zIndex: 500, title: 'Drag to move this corner', crossOnDrag: false, optimized: false })
      made.push(m)
      listeners.push(
        m.addListener('click', () => {
          endHold.current()
          quietUntil.current = Date.now() + 400
          draftRef.current.onPick(draftRef.current.picked === i ? null : i)
        }),
      )
      drags(m, (landed) => ({ kind: 'move', index: i, ...landed }), (p) => draftRef.current.onMove(i, p))
    })
    return () => {
      listeners.forEach((l) => google.maps.event.removeListener(l))
      made.forEach((m) => m.setMap(null))
    }
  }, [map, points, picked, setLive])
  return null
}

/** One dot a finger places or moves: a place. A drag moves it, a press on the map brings it there, and a target it nears catches it. */
function DotLayer({ dot, setLive, coarse }: { dot: PaintedCanvasDot; setLive: (live: PaintedLive | null) => void; coarse: MutableRefObject<boolean> }) {
  const map = useMap()
  const dotRef = useRef(dot)
  dotRef.current = dot
  const marker = useRef<google.maps.Marker | null>(null)
  useEffect(() => {
    if (!map) return
    const settle = (p: PaintedPoint) => settlePoint(p, dotRef.current.targets ?? [], map.getZoom() ?? PAINTED_POINT_ZOOM)
    const where = eventSpot
    const at = dotRef.current.point
    // Over every place and line. Google lifts a dragged marker off its spot and draws a cross under it: neither here, the glass shows the spot.
    const m = new google.maps.Marker({ map, position: { lat: at.lat, lng: at.lng }, draggable: true, icon: svgIcon(DOT_SVG, DOT_BOX), zIndex: 800, title: `Drag to place ${dotRef.current.label}`, crossOnDrag: false, optimized: false })
    marker.current = m
    const drag = (e: google.maps.MapMouseEvent) => {
      const p = where(e)
      if (p) setLive({ kind: 'dot', ...settle(p) })
    }
    const listeners = [
      m.addListener('dragstart', drag),
      m.addListener('drag', drag),
      m.addListener('dragend', (e: google.maps.MapMouseEvent) => {
        const p = where(e)
        if (p) {
          const landed = settle(p).point
          // The marker is put on the spot it landed on here too: caught by the place it left, the caller hands back the same spot and nothing would move it.
          m.setPosition({ lat: landed.lat, lng: landed.lng })
          dotRef.current.onMove(landed)
        }
        setLive(null)
      }),
      // A press on the map brings the dot there, for a dot that is a long drag away.
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        const p = where(e)
        if (p) dotRef.current.onMove(p)
      }),
    ]
    const div = map.getDiv()
    const onDown = (e: PointerEvent) => {
      coarse.current = e.pointerType !== 'mouse'
    }
    div.addEventListener('pointerdown', onDown, true)
    return () => {
      // A placing that ends with a finger still down leaves no glass up.
      setLive(null)
      listeners.forEach((l) => google.maps.event.removeListener(l))
      div.removeEventListener('pointerdown', onDown, true)
      m.setMap(null)
      marker.current = null
    }
  }, [map, setLive, coarse])
  const { lat, lng } = dot.point
  useEffect(() => {
    marker.current?.setPosition({ lat, lng })
  }, [lat, lng])
  const label = dot.label
  useEffect(() => {
    marker.current?.setTitle(`Drag to place ${label}`)
  }, [label])
  return null
}

/**
 * The magnifying glass over Google's map. A fingertip hides the spot it is placing, so the glass shows it two zoom
 * steps in and rides above the finger (`handPlacing.ts`). The picture in it is a second, small Google map, asked for
 * that same view. Google gives a zoom no deeper than its photograph goes at the spot, so the glass reads back the
 * zoom its map took and draws the picture larger only by the steps Google held back: sharp where the photograph goes
 * that deep, and never a zoom Google has no picture for. The lines, the places and the cross are drawn over that
 * picture here, sharp, by the same rule the big map places them.
 */
function Glass({ live, lines, places, draftPoints, mapTypeId, scheme, frame }: { live: PaintedLive; lines: ReadonlyArray<PaintedCanvasLine>; places: ReadonlyArray<PaintedCanvasPlace>; draftPoints: ReadonlyArray<PaintedPoint> | null; mapTypeId: GoogleMapTypeId; scheme: 'DARK' | 'LIGHT'; frame: HTMLElement }) {
  const map = useMap()
  const hole = useRef<HTMLDivElement | null>(null)
  const seen = map ? readView(map) : null
  const zoom = seen ? Math.round(seen.view.zoom) : PAINTED_POINT_ZOOM
  const { lat, lng } = live.point
  // The view the glass looks through, which its own map is asked for.
  const asked = glassView(live.point, zoom).zoom
  // The zoom the glass's map took, read back each time it is asked and each time Google says it changed.
  const [gave, setGave] = useState<number | null>(null)
  // The kept map comes into the glass while a finger is down, and waits off the page between drags.
  useEffect(() => {
    const into = hole.current
    if (!into) return
    const glass = paintedGlassMap(scheme, { center: { lat, lng }, zoom: asked, mapTypeId })
    into.appendChild(glass.host)
    const heard = glass.map.addListener('zoom_changed', () => setGave(glass.map.getZoom() ?? null))
    return () => {
      google.maps.event.removeListener(heard)
      glass.host.remove()
    }
    // Once for a drag: the effect below keeps it on the spot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheme])
  useEffect(() => {
    const glass = keptPaintedGlassMap(scheme)
    if (!glass) return
    const ask = () => {
      glass.map.setOptions({ mapTypeId, ...(googleMapTypeIsImagery(mapTypeId) ? { tilt: 0 } : {}) })
      glass.map.moveCamera({ center: { lat, lng }, zoom: asked })
      setGave(glass.map.getZoom() ?? null)
    }
    ask()
    // On ground it has not drawn before, Google learns how deep its photograph goes a moment after it is asked. It then
    // draws at that depth, and goes on saying the zoom it was asked for until it is asked again. So while the finger
    // rests the glass asks again: a few times by the clock, and when the map's pictures have come in. An ask Google has
    // already answered moves nothing and fetches nothing.
    const again = GLASS_ASK_AGAIN_MS.map((ms) => window.setTimeout(ask, ms))
    let drawn = 0
    const tiles = glass.map.addListener('tilesloaded', () => {
      // Twice at the most for one spot, so a map that says its pictures came in after every ask cannot go round.
      if (drawn++ < 2) ask()
    })
    return () => {
      again.forEach((t) => window.clearTimeout(t))
      google.maps.event.removeListener(tiles)
    }
  }, [lat, lng, asked, mapTypeId, scheme])
  if (!seen) return null
  const at = glassSpot(pointInBox(live.point, seen.view, seen.box), seen.box)
  const half = GLASS_SIZE / 2
  const through = glassView(live.point, zoom)
  const size = { width: GLASS_SIZE, height: GLASS_SIZE }
  const path = (points: ReadonlyArray<PaintedPoint>) => points.map((p) => pointInBox(p, through, size)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  // The picture is drawn larger only by the zoom steps Google held back: by one, which is sharp, where it gave the view.
  const scale = glassPictureScale(asked, gave)
  const hostOffset = (GLASS_SIZE / scale - GLASS_MAP_PX) / 2
  return createPortal(
    <div
      data-painted-glass={live.caught ? 'caught' : 'open'}
      aria-hidden
      style={{ position: 'absolute', left: at.x - half, top: at.y - half, width: GLASS_SIZE, height: GLASS_SIZE, borderRadius: '50%', overflow: 'hidden', zIndex: 900, pointerEvents: 'none', borderWidth: 4, borderStyle: 'solid', borderColor: live.caught ? GLASS_CAUGHT : PAINT_PAPER, boxShadow: '0 6px 18px rgba(0,0,0,.5), 0 0 0 1.5px rgba(17,24,39,.7)', boxSizing: 'border-box', background: 'var(--bg-muted)' }}
    >
      {/* The photograph: the kept map, its middle on the spot, drawn larger by what Google held back. Its own edges, with Google's marks, are outside the glass. */}
      <div data-painted-glass-map data-glass-scale={scale} style={{ position: 'absolute', left: -4, top: -4, width: GLASS_SIZE / scale, height: GLASS_SIZE / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}>
        <div ref={hole} style={{ position: 'absolute', left: hostOffset, top: hostOffset, width: GLASS_MAP_PX, height: GLASS_MAP_PX }} />
      </div>
      <svg width={GLASS_SIZE} height={GLASS_SIZE} style={{ position: 'absolute', left: -4, top: -4, overflow: 'visible' }}>
        {lines.map((line) => {
          const runs = lineRuns(line.points, line.poorParts)
          return (
            <g key={line.id}>
              {runs.sure.map((run, i) => (
                <g key={`s${i}`}>
                  <polyline points={path(run)} fill="none" stroke={PAINT_INK} strokeOpacity={0.9} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
                  <polyline points={path(run)} fill="none" stroke={PAINT_COLOR} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={line.how === 'drawn' ? '14 7' : undefined} />
                </g>
              ))}
              {runs.poor.map((run, i) => (
                <polyline key={`p${i}`} points={path(run)} fill="none" stroke={PAINT_COLOR} strokeOpacity={0.85} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 9" />
              ))}
            </g>
          )
        })}
        {draftPoints && draftPoints.length >= 2 ? (
          <g>
            <polyline points={path(draftPoints)} fill="none" stroke={PAINT_INK} strokeOpacity={0.9} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={path(draftPoints)} fill="none" stroke={PAINT_COLOR} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="14 7" />
          </g>
        ) : null}
      </svg>
      {places.map((p) => {
        const spot = pointInBox(p, through, size)
        const box = placeMarkSize(p.kind, GLASS_PLACE_SIZE)
        // A place far from the finger is off the glass: it is not drawn at all.
        if (spot.x < -box || spot.y < -box || spot.x > GLASS_SIZE + box || spot.y > GLASS_SIZE + box) return null
        // The mark is built by `paintedPlaceKind.ts` from a number and a kind it knows: none of a person's words.
        // eslint-disable-next-line react/no-danger
        return <span key={p.id} data-painted-glass-place style={{ position: 'absolute', left: spot.x - 4 - box / 2, top: spot.y - 4 - box / 2, width: box, height: box }} dangerouslySetInnerHTML={{ __html: placeMarkHtml({ number: p.letter ?? p.number, kind: p.kind }, { size: GLASS_PLACE_SIZE, ink: PAINT_INK, paper: PAINT_PAPER, shadow: true, dashed: p.fromJob === true }) }} />
      })}
      <span style={{ zIndex: 1000, position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1.5, marginLeft: -0.75, background: PAINT_PAPER, opacity: 0.9, boxShadow: '0 0 0 0.5px rgba(17,24,39,.8)' }} />
      <span style={{ zIndex: 1000, position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, marginTop: -0.75, background: PAINT_PAPER, opacity: 0.9, boxShadow: '0 0 0 0.5px rgba(17,24,39,.8)' }} />
      <span style={{ zIndex: 1001, position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, margin: -6, borderRadius: '50%', boxSizing: 'border-box', background: live.caught ? GLASS_CAUGHT : GLASS_PICKED, borderWidth: 2, borderStyle: 'solid', borderColor: PAINT_PAPER }} />
    </div>,
    frame,
  )
}

/** Slides the map to a walker who has neared its edge, and leaves it alone while they are in its middle (`followMe.ts`). */
function Follow({ me }: { me: PaintedPoint }) {
  const map = useMap()
  const { lat, lng } = me
  useEffect(() => {
    if (!map) return
    const div = map.getDiv()
    const c = map.getCenter()
    const z = map.getZoom()
    const to = followStep({ me: { lat, lng }, view: c && z != null ? { center: { lat: c.lat(), lng: c.lng() }, zoom: z } : null, box: { width: div.clientWidth, height: div.clientHeight } })
    if (to) map.panTo(to)
  }, [map, lat, lng])
  return null
}

/**
 * Keeps a reader and the whole map in the picture together. The rule is `frameMe.ts`, the Leaflet canvas's own: the
 * first reading frames everything with the reader, and after that only a dot at the edge of the picture moves it.
 */
function FrameMe({ me, points }: { me: PaintedPoint; points: ReadonlyArray<PaintedPoint> }) {
  const map = useMap()
  const framed = useRef(false)
  const latest = useRef(points)
  latest.current = points
  const { lat, lng } = me
  useEffect(() => {
    if (!map) return
    // The box as it is now, never the one the map last measured: the page's words above the map can change its place.
    const div = map.getDiv()
    const box = { width: div.clientWidth, height: div.clientHeight }
    const c = map.getCenter()
    const z = map.getZoom()
    const step = frameMeStep({ framed: framed.current, me: { lat, lng }, points: latest.current, view: c && z != null ? { center: { lat: c.lat(), lng: c.lng() }, zoom: z } : null, box })
    framed.current = step.framed
    if (step.move) map.moveCamera(step.move)
  }, [map, lat, lng])
  return null
}

/** Moves the map when the caller asks, and says where it is looking each time it settles. */
function Camera({ flyTo, held, refit, points, onView, onCamera }: { flyTo?: PaintedPoint | null; held: PaintedPoint | null; refit?: number; points: ReadonlyArray<PaintedPoint>; onView?: (center: PaintedPoint) => void; onCamera?: (view: PaintedMapView) => void }) {
  const map = useMap()
  // A place the map was already taken to before this canvas came up is not flown to again.
  const flown = useRef(held)
  useEffect(() => {
    if (!map || !flyTo || flown.current === flyTo) return
    flown.current = flyTo
    map.moveCamera({ center: { lat: flyTo.lat, lng: flyTo.lng }, zoom: PAINTED_POINT_ZOOM })
  }, [map, flyTo])

  const seen = useRef(refit)
  const latest = useRef(points)
  latest.current = points
  useEffect(() => {
    if (!map || seen.current === refit) return
    seen.current = refit
    const box = map.getDiv()
    const view = paintedFitView(latest.current, { width: box.clientWidth, height: box.clientHeight })
    if (view) map.moveCamera(view)
  }, [map, refit])

  const tell = useRef({ onView, onCamera })
  tell.current = { onView, onCamera }
  useEffect(() => {
    if (!map) return
    const say = () => {
      const c = map.getCenter()
      if (!c) return
      const center = { lat: c.lat(), lng: c.lng() }
      tell.current.onView?.(center)
      const zoom = map.getZoom()
      if (zoom != null) tell.current.onCamera?.({ center, zoom })
    }
    say()
    const listener = map.addListener('idle', say)
    return () => google.maps.event.removeListener(listener)
  }, [map])
  return null
}

export default function PaintedMapGoogleCanvas({ apiKey, onUnavailable, mapTypeId, lines, places, framed, start, openOn, flyTo, me, frameMargin, follow, frameMe, light, refit, onPlaceTap, draft, dot, onLive, onView, onCamera }: PaintedMapGoogleCanvasProps) {
  const theme = useStampedTheme()
  const scheme = googleColorSchemeForTheme(light ? 'light' : theme)
  // What a finger is doing right now. Kept here for the glass, and told to the caller for its words.
  const [live, setLiveState] = useState<PaintedLive | null>(null)
  const [frame, setFrame] = useState<HTMLDivElement | null>(null)
  const coarse = useRef(false)
  const onLiveRef = useRef(onLive)
  onLiveRef.current = onLive
  const setLive = useCallback((next: PaintedLive | null) => {
    setLiveState(next)
    onLiveRef.current?.(next)
  }, [])
  const [loaded, setLoaded] = useState(false)
  const frameRef = useRef<HTMLDivElement | null>(null)
  useGoogleCanvasDoors({ frameRef, loaded, onUnavailable })

  // The first view is worked out once, from the box's own size. The map is made after it, so it never opens somewhere else first.
  const [first, setFirst] = useState<PaintedMapView | null>(null)
  const opening = useRef({ openOn: openOn ?? null, framed, start: start ?? null, flyTo: flyTo ?? null })
  useLayoutEffect(() => {
    const box = frameRef.current?.getBoundingClientRect()
    const o = opening.current
    setFirst(paintedOpeningView({ carried: o.openOn, points: o.framed, start: o.start, box: { width: box?.width ?? 0, height: box?.height ?? 0 } }))
  }, [])
  // With a view carried over, the place the caller last flew to is behind the painter already.
  const held = opening.current.openOn ? opening.current.flyTo : null
  const everything = [...lines.flatMap((l) => l.points), ...places]
  // The line in hand with the move a finger is making laid over it, for the map and for the glass.
  const draftPoints = draft?.points ?? null
  const draftShown = useMemo(() => (draftPoints ? withLive(draftPoints, live) : null), [draftPoints, live])

  return (
    <GoogleCanvasBoundary onUnavailable={onUnavailable}>
      <div
        ref={(el) => {
          frameRef.current = el
          setFrame(el)
        }}
        data-painted-google-canvas
        data-map-type={mapTypeId}
        style={{ position: 'relative', width: '100%', height: '100%' }}
      >
        {/* Until Google's script is in, the frame holds nothing: no map, no line, no place. On a weak signal that can
            last the whole load timeout, so the frame says what it is doing, in the words the window uses before it. */}
        {loaded ? null : (
          // In the middle of an empty frame: at 320 px the view presses run across its top and would cover a line set there.
          // With lines or places drawn for the wait (`PaintedWaitSketch`) it sits at the bottom, in the room the first view keeps clear, and never on a line.
          <p data-painted-google-loading role="status" style={{ position: 'absolute', inset: 0, zIndex: 2, margin: 0, display: 'flex', alignItems: everything.length > 0 ? 'flex-end' : 'center', justifyContent: 'center', padding: everything.length > 0 ? '0.5rem 1rem' : '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', pointerEvents: 'none' }}>
            {PAINTED_GOOGLE_LOADING_WORDS}
          </p>
        )}
        <APIProvider apiKey={apiKey} onLoad={() => setLoaded(true)} onError={(e) => onUnavailable(`load: ${formatErrorMessage(e)}`)}>
          {/* The lines and places at once, as a plain drawing, until Google's map has drawn them itself. It makes no map. */}
          <PaintedWaitSketch view={first} loaded={loaded} lines={lines} places={places} onPlaceTap={onPlaceTap} />
          {first ? (
            <GoogleMap
              style={{ width: '100%', height: '100%' }}
              defaultCenter={first.center}
              defaultZoom={first.zoom}
              mapTypeId={mapTypeId}
              // A photograph is held flat: zoomed in, Google tilts to its 45° view where it has one, and a line would sit off its ground.
              {...(googleMapTypeIsImagery(mapTypeId) ? { tilt: 0 } : {})}
              colorScheme={scheme}
              // The map is the screen's own, not a card in a page that scrolls: one finger moves it, as on the Leaflet canvas.
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              clickableIcons={false}
              styles={GOOGLE_MAP_STYLES}
              // Two presses on a dot being placed, or on a line being drawn, are two presses and not a zoom.
              disableDoubleClickZoom={!!dot || !!draft}
              reuseMaps
            >
              <Camera flyTo={flyTo} held={held} refit={refit} points={everything} onView={onView} onCamera={onCamera} />
              <Lines lines={lines} />
              <Places places={places} onPlaceTap={onPlaceTap} />
              {follow && me && !me.area ? <Follow me={me} /> : null}
              {frameMargin ? <FrameMargin me={me ?? null} points={everything} /> : null}
              {frameMe && me && !me.area ? <FrameMe me={me} points={everything} /> : null}
              {me ? <Me me={me} /> : null}
              {draft ? <DraftLine points={draftShown ?? []} /> : null}
              {draft ? <DraftLayer draft={draft} setLive={setLive} coarse={coarse} /> : null}
              {dot ? <DotLayer dot={dot} setLive={setLive} coarse={coarse} /> : null}
              {/* A mouse is already that exact, so a mouse gets no glass. */}
              {live && frame && coarse.current ? <Glass live={live} lines={lines} places={places} draftPoints={draftShown} mapTypeId={mapTypeId} scheme={scheme} frame={frame} /> : null}
            </GoogleMap>
          ) : null}
        </APIProvider>
      </div>
    </GoogleCanvasBoundary>
  )
}
