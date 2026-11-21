/**
 * What kind of thing a place on a painted map is (punch list #393): a gate, where to park, a door,
 * a meter, a shutoff, a cleanout, a buried line or a hazard. Each kind has a mark of its own, one
 * small drawing used everywhere a place shows: on the map, beside its name in a list, in a picture
 * and on paper. A place with no kind keeps the plain numbered dot.
 *
 * A buried line says what is buried (punch list #413, Taunya's ask of 2026-11-21): water, sewer,
 * gas, electric, irrigation or cable. Each is a kind of its own, asked under **Buried line**, and
 * wears the color a locator paints on the ground for it.
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
 * - A mark is drawn in ink. A hazard is drawn in red, since it is a warning, and a buried line in
 *   the color a locator paints for what is buried, since that color is how the trade reads it.
 */

export type PaintedBuriedKind = 'buried' | 'buried_water' | 'buried_sewer' | 'buried_gas' | 'buried_electric' | 'buried_irrigation' | 'buried_cable'
export type PaintedPlaceKind = 'gate' | 'parking' | 'door' | 'meter' | 'shutoff' | 'cleanout' | 'hazard' | PaintedBuriedKind

/** A mark on a 24 by 24 grid: one path that is stroked, and the small discs that are filled. */
export type PlaceGlyph = { stroke: string; dots: ReadonlyArray<readonly [cx: number, cy: number, r: number]> }

export type PaintedPlaceKindInfo = {
  kind: PaintedPlaceKind
  /** The kind in a word, as a reader hears it: `Hazard`. */
  label: string
  /** The name its chip gives a place that has none yet: `Park here`. */
  name: string
  /** A warning is drawn in red. Every other mark is drawn in ink, unless it has a color of its own. */
  warns: boolean
  glyph: PlaceGlyph
  /** A color of its own, in place of ink: what a locator paints for a buried line. */
  color?: string
  /** Asked under another press and not beside it: the answers to **What is buried?**. */
  under?: 'buried'
  /** What its own press reads where the question already says the rest: `Sewer` under **What is buried?**. */
  short?: string
}

/** A whole circle as a path, so a mark is one stroke. */
const ring = (cx: number, cy: number, r: number): string => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`

/** A run of pipe under a ground line: the same drawing for every buried line, told apart by its color. */
const BURIED_GLYPH: PlaceGlyph = { stroke: 'M3 8h18M4 15h3.5M10.2 15h3.5M16.5 15h3.5', dots: [] }

/**
 * What a locator paints on the ground for each thing buried (the 811 colors): blue for water, green for sewer,
 * yellow for gas, red for electric, purple for irrigation and orange for cable. Each is a shade that reads on
 * paper white and over a photo of dirt, so gas is a dark yellow.
 */
export const BURIED_COLORS = { water: '#2563eb', sewer: '#16a34a', gas: '#ca8a04', electric: '#dc2626', irrigation: '#9333ea', cable: '#ea580c' } as const

/**
 * Every kind this app knows. The first eight have a press of their own, in the order they are offered: the things
 * a crew and a driver ask about, then what is buried, then the warning. The rest are asked under **Buried line**.
 */
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
  // A line in the ground, with nothing said yet of what it carries.
  { kind: 'buried', label: 'Buried line', name: 'Buried line', warns: false, glyph: BURIED_GLYPH },
  // The warning triangle.
  { kind: 'hazard', label: 'Hazard', name: 'Hazard', warns: true, glyph: { stroke: 'M12 4L21 19.5H3zM12 10v4.5', dots: [[12, 17, 1.1]] } },
  { kind: 'buried_water', label: 'Buried water line', name: 'Buried water line', short: 'Water', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.water, under: 'buried' },
  { kind: 'buried_sewer', label: 'Buried sewer line', name: 'Buried sewer line', short: 'Sewer', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.sewer, under: 'buried' },
  { kind: 'buried_gas', label: 'Buried gas line', name: 'Buried gas line', short: 'Gas', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.gas, under: 'buried' },
  { kind: 'buried_electric', label: 'Buried electric line', name: 'Buried electric line', short: 'Electric', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.electric, under: 'buried' },
  { kind: 'buried_irrigation', label: 'Buried irrigation line', name: 'Buried irrigation line', short: 'Irrigation', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.irrigation, under: 'buried' },
  { kind: 'buried_cable', label: 'Buried cable', name: 'Buried cable', short: 'Cable', warns: false, glyph: BURIED_GLYPH, color: BURIED_COLORS.cable, under: 'buried' },
]

/** The kinds with a press of their own under **What is here?**. */
export const PLACE_KIND_TILES: ReadonlyArray<PaintedPlaceKindInfo> = PAINTED_PLACE_KINDS.filter((k) => !k.under)
/** The answers to **What is buried?**, in the order they are offered. */
export const BURIED_KIND_TILES: ReadonlyArray<PaintedPlaceKindInfo> = PAINTED_PLACE_KINDS.filter((k) => k.under === 'buried')

/** The question a buried line opens, and the press for anything the lists do not hold. */
export const PLACE_KIND_WORDS = {
  buriedAsk: 'What is buried?',
  buriedHint: 'The colors are the ones a locator paints on the ground.',
  somethingElse: '＋ Something else',
  elseAsk: 'What is it?',
  buriedElseAsk: 'What is buried?',
} as const

/** Under the chips of a place's panel. */
export const PLACE_KIND_HINT_WORDS = 'Each of these has its own mark on the map. Press one again to take it off.'

/** The red a warning is drawn in. Saturated on purpose: it has to read on paper white and over a photo of dirt. */
export const PLACE_WARN_COLOR = '#dc2626'

const BY_KIND = new Map<string, PaintedPlaceKindInfo>(PAINTED_PLACE_KINDS.map((k) => [k.kind, k]))

/** What is known about a kind, or null for no kind and for a kind this app does not know. */
export function placeKindInfo(kind: string | null | undefined): PaintedPlaceKindInfo | null {
  return kind ? (BY_KIND.get(kind) ?? null) : null
}

/** A line in the ground, whatever it carries: **Buried line** is pressed for each of them. */
export function isBuriedKind(kind: string | null | undefined): boolean {
  return kind === 'buried' || placeKindInfo(kind)?.under === 'buried'
}

/** The color a kind's mark is drawn in: its own, red for a warning, or the ink it was handed. */
export function placeKindColor(info: Pick<PaintedPlaceKindInfo, 'color' | 'warns'>, ink: string): string {
  return info.color ?? (info.warns ? PLACE_WARN_COLOR : ink)
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
 * A press on **Buried line**. It opens the question under it: a place that is no buried line yet becomes one, with
 * nothing said of what it carries. A place that already says what is buried keeps saying it. A second press on a
 * buried line takes the kind off, as a second press on any kind does.
 */
export function pressBuriedTile(now: { name: string; kind: PaintedPlaceKind | null }): { name: string; kind: PaintedPlaceKind | null } {
  if (isBuriedKind(now.kind)) return { kind: null, name: isChipName(now.name) ? '' : now.name }
  return pressPlaceKindChip(now, 'buried')
}

/**
 * A press on an answer to **What is buried?**. It says what the line carries. A second press on the same answer
 * takes the answer off and leaves a buried line with nothing said of what it carries, since **Buried line** is
 * still pressed above it.
 */
export function pressBuriedAnswer(now: { name: string; kind: PaintedPlaceKind | null }, pressed: PaintedPlaceKind): { name: string; kind: PaintedPlaceKind | null } {
  if (now.kind !== pressed) return pressPlaceKindChip(now, pressed)
  return { kind: 'buried', name: isChipName(now.name) ? (placeKindInfo('buried')?.name ?? '') : now.name }
}

/**
 * A press on **＋ Something else**: the thing is on no list, so the place takes no mark of its own and its name is
 * the person's to type. Under **What is buried?** it stays a buried line. A name a chip gave is cleared, since it
 * named something the person just said this is not. A name somebody typed stays.
 */
export function pressSomethingElse(now: { name: string; kind: PaintedPlaceKind | null }, under?: 'buried'): { name: string; kind: PaintedPlaceKind | null } {
  return { kind: under === 'buried' ? 'buried' : null, name: isChipName(now.name) ? '' : now.name }
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
  const color = placeKindColor(info, look.ink)
  const badge = placeBadgeSize(d)
  const lift = Math.round(badge.size * 0.36)
  return (
    `<span style="position:relative;display:block;width:${d}px;height:${d}px">` +
    `<span style="display:grid;place-items:center;width:${d}px;height:${d}px;box-sizing:border-box;border-radius:50%;background:${look.paper};border:2px ${ring} ${color}${shadow}">${placeGlyphSvg(info.glyph, Math.round(d * PLACE_GLYPH_SHARE), color)}</span>` +
    `<span style="position:absolute;top:-${lift}px;right:-${lift}px;display:grid;place-items:center;min-width:${badge.size}px;height:${badge.size}px;box-sizing:border-box;padding:0 2px;border-radius:999px;background:${look.ink};color:${look.paper};border:1.5px solid ${look.paper};font:800 ${badge.font}px/1 system-ui,sans-serif">${place.number}</span>` +
    `</span>`
  )
}
