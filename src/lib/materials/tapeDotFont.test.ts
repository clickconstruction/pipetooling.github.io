import { describe, expect, it } from 'vitest'
import { DOT_FONT, DOT_FONT_COLS, DOT_FONT_ROWS, dotFontCovers, dotFontSquare, dotTextCells, dotTextHeight, dotTextWidth } from './tapeDotFont'

/** How many squares differ between two glyphs. */
function apart(a: string, b: string): number {
  const ga = DOT_FONT[a]!.join('')
  const gb = DOT_FONT[b]!.join('')
  return [...ga].filter((bit, i) => bit !== gb[i]).length
}

describe('the tape label’s dot font (Taunya’s ask of 2026-11-15)', () => {
  it('draws every letter as seven rows of five squares, ink or none', () => {
    for (const [ch, glyph] of Object.entries(DOT_FONT)) {
      expect(glyph, ch).toHaveLength(DOT_FONT_ROWS)
      for (const row of glyph) expect(row, ch).toMatch(new RegExp(`^[01]{${DOT_FONT_COLS}}$`))
    }
  })

  it('has every character an address carries: capitals, digits, the dot, the slash and the dash', () => {
    for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ./-') expect(ch in DOT_FONT, ch).toBe(true)
    expect(dotFontCovers('PRTS.CO/B/')).toBe(true)
    expect(dotFontCovers('849F-DB0B')).toBe(true)
    expect(dotFontCovers('PRTS.CO/B')).toBe(true)
    expect(dotFontCovers('HTTPS://PRTS.CO/B/849FDB0B')).toBe(true)
    // anything else is drawn in the old face, so no letter is ever left blank
    expect(dotFontCovers('prts.co/b/')).toBe(false)
    expect(dotFontCovers('Test strip')).toBe(false)
    expect(dotFontCovers('CAFÉ')).toBe(false)
    expect(dotFontCovers('')).toBe(false)
  })

  it('no two characters are drawn alike, and every one but the space has ink', () => {
    const drawn = Object.entries(DOT_FONT).map(([ch, glyph]) => [ch, glyph.join('')] as const)
    expect(new Set(drawn.map(([, g]) => g)).size).toBe(drawn.length)
    for (const [ch, g] of drawn) expect(g.includes('1'), ch).toBe(ch !== ' ')
  })

  it('keeps a code’s look-alikes apart: a code is only 0 to 9 and A to F', () => {
    // the zero is slashed, so it is far from a D and an O
    expect(apart('0', 'D')).toBeGreaterThanOrEqual(6)
    expect(apart('0', 'O')).toBeGreaterThanOrEqual(3)
    expect(DOT_FONT['0']![3]).toBe('10101')
    // the B is square at its three left corners where the 8 is round
    expect(apart('8', 'B')).toBe(3)
    expect(DOT_FONT['B']!.map((row) => row[0]).join('')).toBe('1111111')
    expect(DOT_FONT['8']!.map((row) => row[0]).join('')).toBe('0110110')
    // and every pair of the sixteen is at least three squares apart
    const hex = [...'0123456789ABCDEF']
    for (const a of hex) for (const b of hex) if (a < b) expect(apart(a, b), `${a} and ${b}`).toBeGreaterThanOrEqual(3)
  })

  it('is two of the printer’s dots a square on 18 and 24 mm tape, so capitals are 14 dots tall', () => {
    expect(dotFontSquare(128)).toBe(2)
    expect(dotFontSquare(112)).toBe(2)
    expect(dotFontSquare(70)).toBe(1)
    expect(dotTextHeight(2)).toBe(14)
  })

  it('measures a line as its letters and the gaps between them', () => {
    expect(dotTextWidth('8', 2)).toBe(10)
    expect(dotTextWidth('8B', 2)).toBe(22)
    // the address's two lines on the tape: 118 and 106 dots, 16.7 and 15 mm
    expect(dotTextWidth('PRTS.CO/B/', 2)).toBe(118)
    expect(dotTextWidth('849F-DB0B', 2)).toBe(106)
    expect(dotTextWidth('', 2)).toBe(0)
  })

  it('hands the canvas a line’s ink as squares', () => {
    // the dash: one row of five, the fourth of seven
    expect(dotTextCells('-')).toEqual([0, 1, 2, 3, 4].map((x) => ({ x, y: 3 })))
    // the second letter starts six squares along
    const two = dotTextCells('--')
    expect(two).toHaveLength(10)
    expect(two[5]).toEqual({ x: 6, y: 3 })
    // every square is inside the line
    const cells = dotTextCells('PRTS.CO/B/')
    expect(Math.max(...cells.map((c) => c.x))).toBeLessThan(dotTextWidth('PRTS.CO/B/', 1))
    expect(Math.max(...cells.map((c) => c.y))).toBe(DOT_FONT_ROWS - 1)
    expect(Math.min(...cells.map((c) => c.x))).toBe(0)
    // a character the font lacks leaves its place empty
    expect(dotTextCells('é')).toEqual([])
  })
})
