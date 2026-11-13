/**
 * Painted maps as a layer on another map (punch list #345, PR 6): the Map page, and under the
 * boxes on Materials on site's map. Pure: what the layer draws, from the maps as they are read.
 */
import type { PaintedPart, PaintedPoint } from './paintedLine'
import { lineLengthWords, mapSummaryWords, numberedPlaces, type PaintedLine, type PaintedMap, type PaintedPlace } from './paintedMap'

export type PaintedLayerMap = {
  id: string
  name: string
  /** What a pointer over the line reads: the name, then the length and the count of places. */
  tip: string
  lines: Array<{ id: string; points: PaintedPoint[]; poorParts: PaintedPart[] }>
  places: Array<{ id: string; number: number; name: string; lat: number; lng: number }>
}

/** A map as a layer draws it. A map with nothing on it draws nothing and is left out. */
export function paintedLayerMaps(wholes: ReadonlyArray<{ map: Pick<PaintedMap, 'id' | 'name'>; lines: ReadonlyArray<PaintedLine>; places: ReadonlyArray<PaintedPlace> }>): PaintedLayerMap[] {
  return wholes
    .filter((w) => w.lines.length > 0 || w.places.length > 0)
    .map((w) => {
      const summary = mapSummaryWords(w.lines, w.places.length)
      return {
        id: w.map.id,
        name: w.map.name,
        tip: summary ? `${w.map.name} · ${summary}` : w.map.name,
        lines: w.lines.map((l) => ({ id: l.id, points: l.points, poorParts: l.poorParts })),
        places: numberedPlaces(w.places).map((p) => ({ id: p.id, number: p.number, name: p.name, lat: p.lat, lng: p.lng })),
      }
    })
}

/** How many painted maps a layer holds, as its chip counts them. */
export function paintedLayerCount(maps: ReadonlyArray<PaintedLayerMap>): number {
  return maps.length
}

/** Every point a layer draws, for a map that wants to frame them. */
export function paintedLayerPoints(maps: ReadonlyArray<PaintedLayerMap>): PaintedPoint[] {
  return maps.flatMap((m) => [...m.lines.flatMap((l) => l.points), ...m.places.map((p) => ({ lat: p.lat, lng: p.lng }))])
}

/** A line's length as a tooltip on a job's own map reads it. */
export function paintedLayerLineWords(line: Pick<PaintedLine, 'lengthM' | 'marginM' | 'measuredFt' | 'measuredHow'>): string {
  const w = lineLengthWords(line)
  return w.tail ? `${w.lead}, ${w.tail}` : w.lead
}
