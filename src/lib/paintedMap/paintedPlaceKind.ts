/**
 * What kind of thing a place on a painted map is (punch list #393): a gate, where to park, a door,
 * a meter, a shutoff, a cleanout or a hazard. Each kind has a mark of its own, one small drawing
 * used everywhere a place shows: on the map, beside its name in a list, in a picture and on paper.
 * A place with no kind keeps the plain numbered dot.
 *
 * Pure: words and path data. No map, no React, no canvas.
 *
 * The rules the screens lean on:
 * - The list lives here and not in the database, whose check holds only the shape of the word. A
 *   new kind is a line in this file and needs no migration.
 * - A kind this file does not know reads as no kind. An older app draws a newer kind's place as
 *   the plain dot. It never fails on one and never guesses a mark.
 * - A kind is a mark, not a name. A place keeps its own name, and a chip only gives a name to a
 *   place that has none yet.
 * - Every mark is drawn in ink. A hazard alone is drawn in red, since it is a warning.
 */

export type PaintedPlaceKind = 'gate' | 'parking' | 'door' | 'meter' | 'shutoff' | 'cleanout' | 'hazard'

/** A mark on a 24 by 24 grid: one path that is stroked, and the small discs that are filled. */
export type PlaceGlyph = { stroke: string; dots: ReadonlyArray<readonly [cx: number, cy: number, r: number]> }

export type PaintedPlaceKindInfo = {
  kind: PaintedPlaceKind
  /** The kind in a word, as a reader hears it: `Hazard`. */
  label: string
  /** The name its chip gives a place that has none yet: `Park here`. */
  name: string
  /** A warning is drawn in red. Every other mark is drawn in ink. */
  warns: boolean
  glyph: PlaceGlyph
}

/** A whole circle as a path, so a mark is one stroke. */
const ring = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

/** The kinds, in the order their chips are offered: the things a crew and a driver ask about, then the warning. */
export const PAINTED_PLACE_KINDS: ReadonlyArray<PaintedPlaceKindInfo> = [
  // Two posts, two rails and the brace across them.
  { kind: 'gate', label: 'Gate', name: 'Gate', warns: false, glyph: { stroke: 'M5 5v15M19 5v15M5 9h14M5 16h14M5 16L19 9', dots: [] } },
  // The P of every parking sign.
  { kind: 'parking', label: 'Parking', name: 'Park here', warns: false, glyph: { stroke: 'M8.5 20V4.5h4.5a4.25 4.25 0 0 1 0 8.5H8.5', dots: [] } },
  // A door leaf on its floor line, with its knob.
  { kind: 'door', label: 'Door', name: 'Door', warns: false, glyph: { stroke: 'M7.5 20.5v-17h9v17M4.5 20.5h15', dots: [[14, 12.5, 1.2]] } },
  // A dial with its needle, in a run of pipe.
  { kind: 'meter', label: 'Meter', name: 'Meter', warns: false, glyph: { stroke: `${ring(12, 12, 6.5)}M12 12l3.2-3.2M2.5 12h3M18.5 12h3`, dots: [] } },
  // The valve of a plumbing plan: two triangles tip to tip, with its stem and handle.
  { kind: 'shutoff', label: 'Shutoff', name: 'Shutoff', warns: false, glyph: { stroke: 'M5 8v8l7-4zM19 8v8l-7-4zM12 12V6.5M8.5 6.5h7', dots: [] } },
  // A cleanout cap from above: the round cap and its square nut.
  { kind: 'cleanout', label: 'Cleanout', name: 'Cleanout', warns: false, glyph: { stroke: `${ring(12, 12, 7.5)}M9.2 9.2h5.6v5.6h-5.6z`, dots: [] } },
  // The warning triangle.
  { kind: 'hazard', label: 'Hazard', name: 'Hazard', warns: true, glyph: { stroke: 'M12 4L21 19.5H3zM12 10v4.5', dots: [[12, 17, 1.1]] } },
]

/** Under the chips of a place's panel. */
export const PLACE_KIND_HINT_WORDS = 'Each of these has its own mark on the map. Press one again to take it off.'

/** The red a warning is drawn in. Saturated on purpose: it has to read on paper white and over a photo of dirt. */
export const PLACE_WARN_COLOR = '#dc2626'

const BY_KIND = new Map<string, PaintedPlaceKindInfo>(PAINTED_PLACE_KINDS.map((k) => [k.kind, k]))

/** What is known about a kind, or null for no kind and for a kind this app does not know. */
export function placeKindInfo(kind: string | null | undefined): PaintedPlaceKindInfo | null {
  return kind ? (BY_KIND.get(kind) ?? null) : null
}

/** A stored kind as this app knows it. Anything else, a newer app's kind among it, is no kind: the plain dot. */
export function paintedPlaceKindFrom(raw: unknown): PaintedPlaceKind | null {
  return typeof raw === 'string' ? (placeKindInfo(raw)?.kind ?? null) : null
}

const norm = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** The name is one a chip gave and nobody typed: pressing another chip may replace it. */
function isChipName(name: string): boolean {
  const n = norm(name)
  return n === '' || PAINTED_PLACE_KINDS.some((k) => norm(k.name) === n)
}

/**
 * A press on a kind's chip. It gives the place that kind, and a name when the place has none of
 * its own. A second press on the same chip takes the kind off again, and takes the name with it
 * only when the chip gave it. A name somebody typed is never changed by a chip.
 */
export function pressPlaceKindChip(now: { name: string; kind: PaintedPlaceKind | null }, pressed: PaintedPlaceKind): { name: string; kind: PaintedPlaceKind | null } {
  const info = placeKindInfo(pressed)
  if (!info) return now
  if (now.kind === pressed) return { kind: null, name: norm(now.name) === norm(info.name) ? '' : now.name }
  return { kind: pressed, name: isChipName(now.name) ? info.name : now.name }
}

/**
 * A place in words where no mark can be drawn: a hover title, a screen reader, a file.
 * `Hazard: Open trench`, or the name alone when it already says its kind (`Truck gate`).
 */
export function placeSaysWords(place: { name: string; kind?: string | null }): string {
  const info = placeKindInfo(place.kind)
  const name = place.name.trim()
  if (!info) return name
  if (!name) return info.label
  return norm(name).includes(norm(info.label)) || norm(name) === norm(info.name) ? name : `${info.label}: ${name}`
}

/** The disc a mark sits in is a little wider than the plain dot, to hold the drawing. */
export function placeMarkSize(kind: string | null | undefined, size: number): number {
  return placeKindInfo(kind) ? size + 4 : size
}

/** The small disc on a mark's shoulder that carries the place's number: how wide, and how tall its figures. */
export function placeBadgeSize(disc: number): { size: number; font: number } {
  const size = Math.max(13, Math.round(disc * 0.5))
  return { size, font: Math.round(size * 0.68) }
}

/** How much of the disc the drawing fills. */
export const PLACE_GLYPH_SHARE = 0.66

/** A mark's drawing as SVG markup, for a surface that is built as a string: the map's own icons and a printed page. */
export function placeGlyphSvg(glyph: PlaceGlyph, size: number, color: string): string {
  const dots = glyph.dots.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="none"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block"><path d="${glyph.stroke}"/>${dots}</svg>`
}

export type PlaceMarkLook = {
  /** The width of the plain dot. A kind's disc is `placeMarkSize` of it. */
  size: number
  ink: string
  paper: string
  /** A soft shadow under the disc, for a mark that floats over a photo of the ground. */
  shadow?: boolean
  /** A dashed ring: a place kept on the job, drawn on one of the job's painted maps (`paintedJobList.ts`). */
  dashed?: boolean
}

/**
 * A place's mark as HTML, for a surface that is built as a string. With no kind it is the numbered
 * dot a place always was, to the letter. With a kind it is the kind's drawing in a disc, and the
 * number rides on its shoulder, so the dot still answers to its row in the list.
 */
export function placeMarkHtml(place: { number: number | string; kind?: string | null }, look: PlaceMarkLook): string {
  const info = placeKindInfo(place.kind)
  const shadow = look.shadow ? ';box-shadow:0 1px 4px rgba(0,0,0,.5)' : ''
  const ring = look.dashed ? 'dashed' : 'solid'
  if (!info) {
    const s = look.size
    return `<span style="display:grid;place-items:center;width:${s}px;height:${s}px;box-sizing:border-box;border-radius:50%;background:${look.paper};color:${look.ink};border:2px ${ring} ${look.ink};font:800 ${Math.round(s * 0.46)}px/1 system-ui,sans-serif${shadow}">${place.number}</span>`
  }
  const d = placeMarkSize(info.kind, look.size)
  const color = info.warns ? PLACE_WARN_COLOR : look.ink
  const badge = placeBadgeSize(d)
  const lift = Math.round(badge.size * 0.36)
  return (
    `<span style="position:relative;display:block;width:${d}px;height:${d}px">` +
    `<span style="display:grid;place-items:center;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${look.paper};border:2px ${ring} ${color}${shadow}">${placeGlyphSvg(info.glyph, Math.round(d * PLACE_GLYPH_SHARE), color)}</span>` +
    `<span style="position:absolute;top:-${lift}px;right:-${lift}px;display:grid;place-items:center;min-width:${badge.size}px;height:${badge.size}px;box-sizing:border-box;padding:0 2px;border-radius:999px;background:${look.ink};color:${look.paper};border:1.5px solid ${look.paper};font:800 ${badge.font}px/1 system-ui,sans-serif">${place.number}</span>` +
    `</span>`
  )
}
