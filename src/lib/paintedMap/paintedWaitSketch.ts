/**
 * A painted map's lines and places as plain drawing, for the wait before Google's map is up (punch
 * list #387). Pure: points on the ground in, pixels of the frame out.
 *
 * A painted map is read in the field. On a weak signal Google's script can take the whole load
 * timeout, and until it is in there is no map to draw a line on. The lines and the places are
 * already on the phone, so they are drawn at once, with no map under them, each on the pixel
 * Google's map will draw it on: the view is the one the map opens on (`paintedOpeningView`), and
 * the maths is the web maps' own (`worldPx`). When the photograph comes in under them nothing moves.
 *
 * It is a drawing, not a map: it makes no map, on Google or anywhere else, and asks no server for
 * anything.
 */
import { lineRuns, type PaintedPart, type PaintedPoint } from './paintedLine'
import type { PaintedLineHow } from './paintedMap'
import { worldPx } from './paintedMapPicture'
import type { PaintedMapView } from './paintedMapView'

export type SketchBox = { width: number; height: number }

/** One stroke of the drawing: SVG path data in the frame's own pixels, and which of a line's three looks it wears. */
export type SketchStroke = {
  d: string
  /** `sure` is the dark edge with the paint over it. `drawn` is the same with the paint dashed. `poor` is faint dots. */
  look: 'sure' | 'drawn' | 'poor'
}

/** Where a point on the ground sits in the frame, for a map that shows `view` in the middle of `box`. */
export function sketchSpot(p: PaintedPoint, view: PaintedMapView, box: SketchBox): { x: number; y: number } {
  const mid = worldPx(view.center, view.zoom)
  const at = worldPx(p, view.zoom)
  return { x: box.width / 2 + (at.x - mid.x), y: box.height / 2 + (at.y - mid.y) }
}

const r1 = (n: number) => Math.round(n * 10) / 10

function pathOf(run: ReadonlyArray<PaintedPoint>, view: PaintedMapView, box: SketchBox): string {
  return run
    .map((p, i) => {
      const at = sketchSpot(p, view, box)
      return `${i === 0 ? 'M' : 'L'}${r1(at.x)} ${r1(at.y)}`
    })
    .join(' ')
}

/**
 * Every line as the strokes that draw it: its sure stretches, dashed when the line was drawn by
 * hand, and the stretches the phone was not sure of. A box that has not been measured draws nothing.
 */
export function sketchStrokes(lines: ReadonlyArray<{ points: ReadonlyArray<PaintedPoint>; poorParts: ReadonlyArray<PaintedPart>; how: PaintedLineHow }>, view: PaintedMapView, box: SketchBox): SketchStroke[] {
  if (!(box.width > 0 && box.height > 0)) return []
  const strokes: SketchStroke[] = []
  for (const line of lines) {
    const runs = lineRuns(line.points, line.poorParts)
    for (const run of runs.sure) strokes.push({ d: pathOf(run, view, box), look: line.how === 'drawn' ? 'drawn' : 'sure' })
    for (const run of runs.poor) strokes.push({ d: pathOf(run, view, box), look: 'poor' })
  }
  return strokes
}
