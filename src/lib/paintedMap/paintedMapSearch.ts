/**
 * Painted maps in the header's search (punch list #345, PR 6): the door with no job open. Type
 * *paint* and **Paint a map** is there, and a painted map is found by its name, its words and the
 * job it is on. Pure: the read is `loadPaintedMapsForSearch` in `paintedMapIo.ts`.
 *
 * A door is a link, so opening a map from the search is an address the one host reads:
 * `?paintMap=1` opens the start sheet, `?paintedMap=<id>` opens that map.
 */
import type { Door } from '../search/doors'

export const PAINT_A_MAP_PARAM = 'paintMap'
export const PAINTED_MAP_PARAM = 'paintedMap'
/** Where the search sends a painted map's door: the page every role has. */
export const PAINTED_MAP_DOOR_PATH = '/dashboard'
export const PAINT_A_MAP_LINK = `${PAINTED_MAP_DOOR_PATH}?${PAINT_A_MAP_PARAM}=1`

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function paintedMapLink(mapId: string): string {
  return `${PAINTED_MAP_DOOR_PATH}?${PAINTED_MAP_PARAM}=${encodeURIComponent(mapId)}`
}

/** What an address asks the host for: the start sheet, one map, or nothing. An id that is not an id asks for nothing. */
export function paintedMapAskFromSearch(params: URLSearchParams): { kind: 'start' } | { kind: 'open'; mapId: string } | null {
  const id = params.get(PAINTED_MAP_PARAM)
  if (id && UUID_RE.test(id)) return { kind: 'open', mapId: id }
  if (params.get(PAINT_A_MAP_PARAM)) return { kind: 'start' }
  return null
}

/** The address with the painted map's keys taken off, so a reload or Back does not open the window again. */
export function withoutPaintedMapAsk(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete(PAINT_A_MAP_PARAM)
  next.delete(PAINTED_MAP_PARAM)
  return next
}

/** A painted map as the search reads it: its home said in words, when the reader can see the home. */
export type PaintedMapSearchRow = { id: string; name: string; words: string; jobLabel: string | null; developmentLabel: string | null; hasHome: boolean }

/** `J523 · Mission Flats`, `Dry Creek Ridge, every lot`, or that it is on no job yet. */
export function paintedMapWhereWords(row: Pick<PaintedMapSearchRow, 'jobLabel' | 'developmentLabel' | 'hasHome'>): string {
  if (row.jobLabel) return row.jobLabel
  if (row.developmentLabel) return `${row.developmentLabel}, every lot`
  return row.hasHome ? 'A painted map' : 'On no job yet'
}

/** One door per painted map the reader can open, in the order given. */
export function paintedMapDoors(rows: ReadonlyArray<PaintedMapSearchRow>): Door[] {
  return rows.map((r) => {
    const where = paintedMapWhereWords(r)
    return {
      id: `painted-map:${r.id}`,
      kind: 'map',
      label: r.name,
      where: r.words.trim() ? `${where} · ${r.words.trim()}` : where,
      words: [r.name.toLowerCase(), r.words.toLowerCase(), where.toLowerCase(), 'painted map', 'map', 'way in'].filter(Boolean),
      to: paintedMapLink(r.id),
      gate: () => true,
    } satisfies Door
  })
}
