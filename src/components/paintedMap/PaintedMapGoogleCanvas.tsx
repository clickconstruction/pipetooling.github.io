/**
 * A painted map on a Google map, for looking (punch list #387): its lines, its numbered places and
 * the person's own dot, over Google's photograph or its road map. It draws no corner and takes no
 * drawing press. While a line or a place is being made, and while Time is on, the Leaflet canvas is
 * the map (`paintedMapProvider.ts`), and `PaintedMapCanvas` mounts one or the other.
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
 * - **One map, kept.** Google bills by the map made. `reuseMaps` puts the map away when this canvas
 *   leaves and brings the same one back, so going to Time and back, or closing a painted map and
 *   opening another, makes no new one for as long as the page is open.
 *
 * Its doors to Leaflet are the pins canvas's own (`useGoogleCanvasDoors`). Lazy-load this file: it
 * pulls in the Maps library.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { APIProvider, Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import { useGoogleCanvasDoors, useStampedTheme } from '../../hooks/useGoogleCanvasDoors'
import { googleColorSchemeForTheme } from '../../lib/dashboardJobsMap'
import { googleMapTypeIsImagery, type GoogleMapTypeId } from '../../lib/map/googleMapType'
import { MARGIN_FRAME_PADDING_PX, marginFrameStep, type MarginFramed, type PaintedCanvasMe } from '../../lib/paintedMap/marginFrame'
import { areaEdgeStroke, circleRing, poorRunStroke, sureRunStrokes, type GoogleLineStroke } from '../../lib/paintedMap/paintedGoogleShapes'
import { lineRuns, type PaintedPoint } from '../../lib/paintedMap/paintedLine'
import { PAINTED_POINT_ZOOM, paintedFitView, paintedOpeningView, paintedViewBounds, type PaintedMapView } from '../../lib/paintedMap/paintedMapView'
import { placeMarkHtml, placeMarkSize, placeSaysWords } from '../../lib/paintedMap/paintedPlaceKind'
import { formatErrorMessage } from '../../utils/errorHandling'
import { GoogleCanvasBoundary } from '../map/GoogleCanvasBoundary'
import type { PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import { PAINT_COLOR, PAINT_INK, PAINT_ME_BLUE, PAINT_PAPER } from './paintedMapLook'

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
  /** Frame everything on the map again each time this number changes. */
  refit?: number
  onPlaceTap?: (id: string) => void
  /** The middle of what the map is showing, each time it settles. */
  onView?: (center: PaintedPoint) => void
  /** The whole view each time it settles, for the caller to hand to the other canvas. */
  onCamera?: (view: PaintedMapView) => void
}

const LOOK = { ink: PAINT_INK, paint: PAINT_COLOR }
const PLACE_SIZE = 26
/** The person's dot, as the Leaflet canvas draws it: smaller than the dot a finger drags. */
const ME_BOX = 22
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

/** The saved lines. Drawn again whole when the list changes: a map being read changes rarely. */
function Lines({ lines }: { lines: ReadonlyArray<PaintedCanvasLine> }) {
  const map = useMap()
  useEffect(() => {
    if (!map) return
    const made: google.maps.Polyline[] = []
    const stroke = (run: ReadonlyArray<PaintedPoint>, look: GoogleLineStroke) => {
      made.push(new google.maps.Polyline({ map, path: run.map((p) => ({ lat: p.lat, lng: p.lng })), clickable: false, ...look }))
    }
    for (const line of lines) {
      const runs = lineRuns(line.points, line.poorParts)
      for (const run of runs.sure) for (const look of sureRunStrokes(line.how, LOOK)) stroke(run, look)
      for (const run of runs.poor) stroke(run, poorRunStroke(LOOK))
    }
    return () => made.forEach((l) => l.setMap(null))
  }, [map, lines])
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

export default function PaintedMapGoogleCanvas({ apiKey, onUnavailable, mapTypeId, lines, places, framed, start, openOn, flyTo, me, frameMargin, refit, onPlaceTap, onView, onCamera }: PaintedMapGoogleCanvasProps) {
  const theme = useStampedTheme()
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

  return (
    <GoogleCanvasBoundary onUnavailable={onUnavailable}>
      <div ref={frameRef} data-painted-google-canvas data-map-type={mapTypeId} style={{ width: '100%', height: '100%' }}>
        <APIProvider apiKey={apiKey} onLoad={() => setLoaded(true)} onError={(e) => onUnavailable(`load: ${formatErrorMessage(e)}`)}>
          {first ? (
            <GoogleMap
              style={{ width: '100%', height: '100%' }}
              defaultCenter={first.center}
              defaultZoom={first.zoom}
              mapTypeId={mapTypeId}
              // A photograph is held flat: zoomed in, Google tilts to its 45° view where it has one, and a line would sit off its ground.
              {...(googleMapTypeIsImagery(mapTypeId) ? { tilt: 0 } : {})}
              colorScheme={googleColorSchemeForTheme(theme)}
              // The map is the screen's own, not a card in a page that scrolls: one finger moves it, as on the Leaflet canvas.
              gestureHandling="greedy"
              disableDefaultUI
              zoomControl
              clickableIcons={false}
              reuseMaps
            >
              <Camera flyTo={flyTo} held={held} refit={refit} points={everything} onView={onView} onCamera={onCamera} />
              <Lines lines={lines} />
              <Places places={places} onPlaceTap={onPlaceTap} />
              {frameMargin ? <FrameMargin me={me ?? null} points={everything} /> : null}
              {me ? <Me me={me} /> : null}
            </GoogleMap>
          ) : null}
        </APIProvider>
      </div>
    </GoogleCanvasBoundary>
  )
}
