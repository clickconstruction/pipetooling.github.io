/**
 * A painted map's lines and places, drawn at once while Google's map is on its way (punch list #387).
 *
 * `PaintedMapGoogleCanvas` mounts it inside its `APIProvider`. Until Google's script is in there is
 * no map to draw on, and on a weak signal that can last the whole load timeout. So the lines and the
 * numbered places are drawn here as a plain drawing, on the very pixels Google's map will draw them
 * on (`paintedWaitSketch.ts`). When Google's map has drawn itself the drawing goes, and nothing moves.
 *
 * - **It makes no map** and asks no server for anything, so it changes nothing about when or how
 *   often a Google map is made.
 * - **It is for the wait alone.** On a page where Google's script is already in, the map is up at
 *   once and this draws nothing: a map brought back from Time, or a second painted map opened.
 * - **It takes no drag.** The map under it takes over within the load timeout, on Google or on
 *   Leaflet. A place can be pressed, as on the map.
 * - **It goes** when Google's map says it has settled, or the reader begins to move it, or a few
 *   seconds after the script came in, whichever is first. By then Google's own lines are drawn.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import type { PaintedMapView } from '../../lib/paintedMap/paintedMapView'
import { placeMarkHtml, placeMarkSize, placeSaysWords } from '../../lib/paintedMap/paintedPlaceKind'
import { sketchSpot, sketchStrokes, type SketchBox } from '../../lib/paintedMap/paintedWaitSketch'
import type { PaintedCanvasLine, PaintedCanvasPlace } from './PaintedMapCanvas'
import { PAINT_COLOR, PAINT_INK, PAINT_PAPER } from './paintedMapLook'

/** The size of a place's dot, the Google canvas's own. */
const PLACE_SIZE = 26
/** How long the drawing may stay once Google's script is in, if the map never says it has settled. */
export const WAIT_SKETCH_LINGER_MS = 3000

/** Whether Google's map code is on the page already: another map loaded it, or this canvas did before. */
function googleIsIn(): boolean {
  return typeof google !== 'undefined' && typeof google.maps?.Map === 'function'
}

export type PaintedWaitSketchProps = {
  /** The view Google's map opens on. Null until the frame has been measured. */
  view: PaintedMapView | null
  /** Google's script is in. */
  loaded: boolean
  lines: ReadonlyArray<PaintedCanvasLine>
  places: ReadonlyArray<PaintedCanvasPlace>
  onPlaceTap?: (id: string) => void
}

export function PaintedWaitSketch({ view, loaded, lines, places, onPlaceTap }: PaintedWaitSketchProps) {
  const map = useMap()
  const ref = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState<SketchBox>({ width: 0, height: 0 })
  // Decided once, when the canvas comes up: with Google's script already in there is no wait to draw for.
  const [done, setDone] = useState(googleIsIn)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      setBox((was) => (was.width === r.width && was.height === r.height ? was : { width: r.width, height: r.height }))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(measure)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Google's map has settled, or the reader has begun to move it: its own lines are drawn and this one's work is done.
  useEffect(() => {
    if (!map || done) return
    const end = () => setDone(true)
    const listeners = [map.addListener('idle', end), map.addListener('dragstart', end), map.addListener('zoom_changed', end)]
    return () => listeners.forEach((l) => google.maps.event.removeListener(l))
  }, [map, done])

  // A map that never says it has settled still has its lines drawn a moment after the script is in.
  useEffect(() => {
    if (!loaded || done) return
    const t = window.setTimeout(() => setDone(true), WAIT_SKETCH_LINGER_MS)
    return () => window.clearTimeout(t)
  }, [loaded, done])

  if (done) return null
  const strokes = view ? sketchStrokes(lines, view, box) : []
  const measured = box.width > 0 && box.height > 0
  return (
    <div ref={ref} data-painted-wait-sketch style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden', pointerEvents: 'none' }}>
      <svg width={box.width} height={box.height} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, display: 'block' }}>
        {strokes.map((s, i) =>
          s.look === 'poor' ? (
            <path key={i} data-sketch-look="poor" d={s.d} fill="none" stroke={PAINT_COLOR} strokeWidth={4} strokeOpacity={0.85} strokeDasharray="2 9" strokeLinecap="round" />
          ) : (
            <g key={i} data-sketch-look={s.look}>
              <path d={s.d} fill="none" stroke={PAINT_INK} strokeWidth={8} strokeOpacity={0.9} strokeLinejoin="round" strokeLinecap="round" />
              <path d={s.d} fill="none" stroke={PAINT_COLOR} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.look === 'drawn' ? '14 7' : undefined} />
            </g>
          ),
        )}
      </svg>
      {view && measured
        ? places.map((p) => {
            const size = placeMarkSize(p.kind, PLACE_SIZE)
            const at = sketchSpot(p, view, box)
            const words = placeSaysWords(p)
            return (
              <button
                key={p.id}
                type="button"
                data-painted-wait-place={p.id}
                title={words}
                aria-label={words}
                disabled={!onPlaceTap}
                onClick={onPlaceTap ? () => onPlaceTap(p.id) : undefined}
                style={{ position: 'absolute', left: Math.round(at.x - size / 2), top: Math.round(at.y - size / 2), width: size, height: size, padding: 0, border: 0, background: 'none', fontFamily: 'inherit', pointerEvents: onPlaceTap ? 'auto' : 'none', cursor: onPlaceTap ? 'pointer' : 'default' }}
                // The mark is the kernel's own HTML, the one both maps draw: made from a number and a kind, never from words a person typed.
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: placeMarkHtml({ number: p.letter ?? p.number, kind: p.kind }, { size: PLACE_SIZE, ink: PAINT_INK, paper: PAINT_PAPER, shadow: true, dashed: p.fromJob === true }) }}
              />
            )
          })
        : null}
    </div>
  )
}
