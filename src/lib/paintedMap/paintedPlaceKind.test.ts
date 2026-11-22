import { describe, expect, it } from 'vitest'
import {
  BURIED_COLORS,
  BURIED_KIND_TILES,
  PAINTED_PLACE_KINDS,
  PLACE_KIND_TILES,
  PLACE_WARN_COLOR,
  isBuriedKind,
  paintedPlaceKindFrom,
  placeBadgeSize,
  placeGlyphSvg,
  placeKindColor,
  placeKindInfo,
  placeMarkHtml,
  placeMarkSize,
  placeSaysWords,
  pressBuriedAnswer,
  pressBuriedTile,
  pressPlaceKindChip,
  pressSomethingElse,
} from './paintedPlaceKind'

const LOOK = { size: 26, ink: 'INK', paper: 'PAPER', shadow: true }

describe('the kinds of place', () => {
  it('offers the six names the panel always had, in their order, then a buried line, and then the warning', () => {
    expect(PLACE_KIND_TILES.map((k) => k.name)).toEqual(['Gate', 'Park here', 'Door', 'Meter', 'Shutoff', 'Cleanout', 'Buried line', 'Hazard'])
    expect(PLACE_KIND_TILES.map((k) => k.kind)).toEqual(['gate', 'parking', 'door', 'meter', 'shutoff', 'cleanout', 'buried', 'hazard'])
    expect(new Set(PLACE_KIND_TILES.map((k) => k.glyph.stroke)).size).toBe(PLACE_KIND_TILES.length)
  })
  it('asks what is buried under Buried line: six answers, each in the color a locator paints for it', () => {
    expect(BURIED_KIND_TILES.map((k) => k.short)).toEqual(['Water', 'Sewer', 'Gas', 'Electric', 'Irrigation', 'Cable'])
    expect(BURIED_KIND_TILES.map((k) => k.kind)).toEqual(['buried_water', 'buried_sewer', 'buried_gas', 'buried_electric', 'buried_irrigation', 'buried_cable'])
    expect(BURIED_KIND_TILES.map((k) => k.name)).toEqual(['Buried water line', 'Buried sewer line', 'Buried gas line', 'Buried electric line', 'Buried irrigation line', 'Buried cable'])
    expect(BURIED_KIND_TILES.map((k) => k.color)).toEqual([BURIED_COLORS.water, BURIED_COLORS.sewer, BURIED_COLORS.gas, BURIED_COLORS.electric, BURIED_COLORS.irrigation, BURIED_COLORS.cable])
    // One drawing for every buried line: they are told apart by color, and each color is its own.
    expect(new Set(BURIED_KIND_TILES.map((k) => k.glyph.stroke)).size).toBe(1)
    expect(new Set(BURIED_KIND_TILES.map((k) => k.color)).size).toBe(BURIED_KIND_TILES.length)
    expect(BURIED_KIND_TILES.every((k) => /^#[0-9a-f]{6}$/.test(k.color ?? ''))).toBe(true)
  })
  it('knows every kind it offers, and no other', () => {
    expect(PAINTED_PLACE_KINDS).toHaveLength(PLACE_KIND_TILES.length + BURIED_KIND_TILES.length)
    for (const k of PAINTED_PLACE_KINDS) expect(placeKindInfo(k.kind)).toBe(k)
    for (const k of PAINTED_PLACE_KINDS) expect(k.name.length).toBeLessThanOrEqual(40)
  })
  it('takes each of them for a buried line, and nothing else', () => {
    expect(['buried', ...BURIED_KIND_TILES.map((k) => k.kind)].every((k) => isBuriedKind(k))).toBe(true)
    expect(['gate', 'hazard', 'cleanout', null, undefined, 'buried_treasure'].some((k) => isBuriedKind(k))).toBe(false)
  })
  it('draws a mark in its own color, in red for a warning, and in ink otherwise', () => {
    expect(placeKindColor(placeKindInfo('buried_sewer')!, '#111')).toBe(BURIED_COLORS.sewer)
    expect(placeKindColor(placeKindInfo('hazard')!, '#111')).toBe(PLACE_WARN_COLOR)
    expect(placeKindColor(placeKindInfo('gate')!, '#111')).toBe('#111')
    expect(placeKindColor(placeKindInfo('buried')!, '#111')).toBe('#111')
  })
  it('stores every kind as a word the table\'s check keeps', () => {
    for (const k of PAINTED_PLACE_KINDS) expect(k.kind).toMatch(/^[a-z][a-z_]{1,23}$/)
  })
  it('draws every mark inside its 24 by 24 grid, from path commands alone', () => {
    for (const k of PAINTED_PLACE_KINDS) {
      // Nothing but the letters of a path and its numbers: this string goes into markup as it stands.
      expect(k.glyph.stroke).toMatch(/^[MmLlHhVvAaZz0-9 .\-]+$/)
      // Every absolute move starts on the grid.
      for (const m of k.glyph.stroke.matchAll(/M(-?[\d.]+) (-?[\d.]+)/g)) {
        for (const n of [Number(m[1]), Number(m[2])]) {
          expect(n).toBeGreaterThanOrEqual(1)
          expect(n).toBeLessThanOrEqual(23)
        }
      }
      for (const [cx, cy, r] of k.glyph.dots) {
        expect(cx - r).toBeGreaterThan(0)
        expect(cy + r).toBeLessThan(24)
      }
    }
  })
  it('warns with the hazard alone', () => {
    expect(PAINTED_PLACE_KINDS.filter((k) => k.warns).map((k) => k.kind)).toEqual(['hazard'])
  })
  it('reads a stored kind it knows, and takes any other for no kind', () => {
    expect(paintedPlaceKindFrom('gate')).toBe('gate')
    expect(paintedPlaceKindFrom('hazard')).toBe('hazard')
    // A newer app's kind, a wrong case, nothing, and a thing that is not a word.
    expect(paintedPlaceKindFrom('fire_hydrant')).toBeNull()
    expect(paintedPlaceKindFrom('Gate')).toBeNull()
    expect(paintedPlaceKindFrom('')).toBeNull()
    expect(paintedPlaceKindFrom(null)).toBeNull()
    expect(paintedPlaceKindFrom(7)).toBeNull()
    expect(placeKindInfo('fire_hydrant')).toBeNull()
    expect(placeKindInfo('parking')?.label).toBe('Parking')
  })
})

describe('a press on a kind\'s chip', () => {
  it('gives a place with no name the kind and the chip\'s name', () => {
    expect(pressPlaceKindChip({ name: '', kind: null }, 'parking')).toEqual({ name: 'Park here', kind: 'parking' })
    expect(pressPlaceKindChip({ name: '   ', kind: null }, 'gate')).toEqual({ name: 'Gate', kind: 'gate' })
  })
  it('never changes a name somebody typed', () => {
    expect(pressPlaceKindChip({ name: 'Truck gate', kind: null }, 'gate')).toEqual({ name: 'Truck gate', kind: 'gate' })
    expect(pressPlaceKindChip({ name: 'Open trench', kind: 'gate' }, 'hazard')).toEqual({ name: 'Open trench', kind: 'hazard' })
  })
  it('swaps a name another chip gave', () => {
    expect(pressPlaceKindChip({ name: 'Gate', kind: 'gate' }, 'meter')).toEqual({ name: 'Meter', kind: 'meter' })
    expect(pressPlaceKindChip({ name: 'park here', kind: 'parking' }, 'door')).toEqual({ name: 'Door', kind: 'door' })
  })
  it('takes the kind off on a second press, and the name with it only when the chip gave it', () => {
    expect(pressPlaceKindChip({ name: 'Gate', kind: 'gate' }, 'gate')).toEqual({ name: '', kind: null })
    expect(pressPlaceKindChip({ name: 'Truck gate', kind: 'gate' }, 'gate')).toEqual({ name: 'Truck gate', kind: null })
  })
})

describe('a press on Buried line, and on what is buried', () => {
  it('makes a place a buried line with nothing said of what it carries', () => {
    expect(pressBuriedTile({ name: '', kind: null })).toEqual({ kind: 'buried', name: 'Buried line' })
    expect(pressBuriedTile({ name: 'Cleanout', kind: 'cleanout' })).toEqual({ kind: 'buried', name: 'Buried line' })
    expect(pressBuriedTile({ name: 'Along the fence', kind: null })).toEqual({ kind: 'buried', name: 'Along the fence' })
  })
  it('takes the kind off on a second press, whatever was buried', () => {
    expect(pressBuriedTile({ name: 'Buried line', kind: 'buried' })).toEqual({ kind: null, name: '' })
    expect(pressBuriedTile({ name: 'Buried sewer line', kind: 'buried_sewer' })).toEqual({ kind: null, name: '' })
    expect(pressBuriedTile({ name: 'Along the fence', kind: 'buried_gas' })).toEqual({ kind: null, name: 'Along the fence' })
  })
  it('says what is buried, and names the place for it', () => {
    expect(pressBuriedAnswer({ name: 'Buried line', kind: 'buried' }, 'buried_sewer')).toEqual({ kind: 'buried_sewer', name: 'Buried sewer line' })
    expect(pressBuriedAnswer({ name: 'Buried sewer line', kind: 'buried_sewer' }, 'buried_water')).toEqual({ kind: 'buried_water', name: 'Buried water line' })
    expect(pressBuriedAnswer({ name: 'Along the fence', kind: 'buried' }, 'buried_gas')).toEqual({ kind: 'buried_gas', name: 'Along the fence' })
  })
  it('takes the answer off on a second press and leaves a buried line', () => {
    expect(pressBuriedAnswer({ name: 'Buried sewer line', kind: 'buried_sewer' }, 'buried_sewer')).toEqual({ kind: 'buried', name: 'Buried line' })
    expect(pressBuriedAnswer({ name: 'Along the fence', kind: 'buried_sewer' }, 'buried_sewer')).toEqual({ kind: 'buried', name: 'Along the fence' })
  })
})

describe('a press on Something else', () => {
  it('leaves the place with no mark and a name to type', () => {
    expect(pressSomethingElse({ name: 'Cleanout', kind: 'cleanout' })).toEqual({ kind: null, name: '' })
    expect(pressSomethingElse({ name: '', kind: null })).toEqual({ kind: null, name: '' })
  })
  it('keeps a name somebody typed', () => {
    expect(pressSomethingElse({ name: 'Septic tank lid', kind: 'cleanout' })).toEqual({ kind: null, name: 'Septic tank lid' })
  })
  it('stays a buried line under What is buried?', () => {
    expect(pressSomethingElse({ name: 'Buried sewer line', kind: 'buried_sewer' }, 'buried')).toEqual({ kind: 'buried', name: '' })
    expect(pressSomethingElse({ name: 'Conduit for the gate', kind: 'buried' }, 'buried')).toEqual({ kind: 'buried', name: 'Conduit for the gate' })
  })
})

describe('a place in words, where no mark can be drawn', () => {
  it('leads with what is buried, unless the name already says it', () => {
    expect(placeSaysWords({ name: 'Buried sewer line', kind: 'buried_sewer' })).toBe('Buried sewer line')
    expect(placeSaysWords({ name: 'Along the fence', kind: 'buried_sewer' })).toBe('Buried sewer line: Along the fence')
  })
  it('leads with the kind unless the name already says it', () => {
    expect(placeSaysWords({ name: 'Open trench', kind: 'hazard' })).toBe('Hazard: Open trench')
    expect(placeSaysWords({ name: 'Truck gate', kind: 'gate' })).toBe('Truck gate')
    expect(placeSaysWords({ name: 'Park here', kind: 'parking' })).toBe('Park here')
    expect(placeSaysWords({ name: 'Behind the hedge', kind: 'meter' })).toBe('Meter: Behind the hedge')
  })
  it('is the name alone for a plain place and for a kind it does not know', () => {
    expect(placeSaysWords({ name: 'The slab' })).toBe('The slab')
    expect(placeSaysWords({ name: 'The slab', kind: null })).toBe('The slab')
    expect(placeSaysWords({ name: 'Hydrant', kind: 'fire_hydrant' })).toBe('Hydrant')
    expect(placeSaysWords({ name: '', kind: 'door' })).toBe('Door')
  })
})

describe('a place\'s mark as markup', () => {
  it('draws a buried line in the color a locator paints for it, ring and mark, and keeps its letter in ink', () => {
    const html = placeMarkHtml({ number: 'C', kind: 'buried_sewer' }, { size: 24, ink: '#111827', paper: '#ffffff' })
    expect(html).toContain(`border:2px solid ${BURIED_COLORS.sewer}`)
    expect(html).toContain(`stroke="${BURIED_COLORS.sewer}"`)
    expect(html).toContain('background:#111827;color:#ffffff')
  })
  it('is the numbered dot a place always was when it has no kind, to the letter', () => {
    const was = '<span style="display:grid;place-items:center;width:26px;height:26px;box-sizing:border-box;border-radius:50%;background:PAPER;color:INK;border:2px solid INK;font:800 12px/1 system-ui,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.5)">3</span>'
    expect(placeMarkHtml({ number: 3 }, LOOK)).toBe(was)
    expect(placeMarkHtml({ number: 3, kind: null }, LOOK)).toBe(was)
    // A kind this app does not know is drawn as the plain dot, never guessed at.
    expect(placeMarkHtml({ number: 3, kind: 'fire_hydrant' }, LOOK)).toBe(was)
  })
  it('draws a kind\'s mark in a wider disc, with the number on its shoulder', () => {
    const html = placeMarkHtml({ number: 12, kind: 'gate' }, LOOK)
    expect(html).toContain('width:30px;height:30px')
    expect(html).toContain(`<path d="${placeKindInfo('gate')!.glyph.stroke}"/>`)
    expect(html).toContain('stroke="INK"')
    expect(html).toContain('>12</span>')
    expect(html).not.toContain(PLACE_WARN_COLOR)
    expect(placeMarkSize('gate', 26)).toBe(30)
    expect(placeMarkSize(null, 26)).toBe(26)
    expect(placeMarkSize('fire_hydrant', 26)).toBe(26)
  })
  it('draws a hazard in red, ring and mark, and keeps its number in ink', () => {
    const html = placeMarkHtml({ number: 2, kind: 'hazard' }, LOOK)
    expect(html).toContain(`border:2px solid ${PLACE_WARN_COLOR}`)
    expect(html).toContain(`stroke="${PLACE_WARN_COLOR}"`)
    expect(html).toContain(`fill="${PLACE_WARN_COLOR}"`)
    expect(html).toContain('background:INK;color:PAPER')
  })
  it('leaves the shadow off a mark on paper', () => {
    expect(placeMarkHtml({ number: 1, kind: 'door' }, { size: 24, ink: 'INK', paper: 'PAPER' })).not.toContain('box-shadow')
    expect(placeMarkHtml({ number: 1 }, { size: 24, ink: 'INK', paper: 'PAPER' })).not.toContain('box-shadow')
  })
  it('keeps the number readable on a small mark', () => {
    expect(placeBadgeSize(30)).toEqual({ size: 15, font: 10 })
    expect(placeBadgeSize(20).size).toBe(13)
  })
  it('draws a mark\'s filled discs with no stroke', () => {
    const svg = placeGlyphSvg(placeKindInfo('door')!.glyph, 18, 'INK')
    expect(svg).toContain('width="18" height="18"')
    expect(svg).toContain('<circle cx="14" cy="12.5" r="1.2" fill="INK" stroke="none"/>')
  })
})
