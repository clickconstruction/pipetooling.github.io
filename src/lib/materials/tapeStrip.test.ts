import { describe, expect, it } from 'vitest'

import { dotTextHeight } from './tapeDotFont'
import { bigCodeSquare, qrSquares, qrSquaresFromPath, tapeAddressLines, tapeStencilPx, tapeStripBlock, tapeStripLayout, tapeStripLines } from './tapeStrip'

describe('tapeStripLayout', () => {
  it('gives the code a whole number of dots a square, as tall as the tape prints', () => {
    const big = tapeStripLayout(128, 25)
    expect(big.dotsPerSquare).toBe(5)
    expect(big.qrSize).toBe(125)
    expect(big.qrTop).toBe(1)
    expect(big.qrTop + big.qrSize).toBeLessThanOrEqual(128)
    // two squares clear at the cut edge, four before the words
    expect(big.qrLeft).toBe(10)
    expect(big.textLeft).toBe(10 + 125 + 20)
    const small = tapeStripLayout(112, 25)
    expect(small.dotsPerSquare).toBe(4)
    expect(small.qrSize).toBe(100)
    expect(small.qrTop).toBe(6)
  })

  it('sets the address in the dot font at two dots a square on both tapes, a line of 17 dots', () => {
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      expect(l.codeSquare).toBe(2)
      expect(l.codePx).toBe(17)
    }
  })

  it('keeps the stencil and the lines under it inside the strip', () => {
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      expect(l.stencilPx + l.codePx * 1.2 + l.codePx * 1.2 + 6).toBeLessThanOrEqual(dots)
      expect(l.stencilPx + l.codePx * 1.2 + l.wordsPx * 1.2 + 6).toBeLessThanOrEqual(dots)
    }
  })
})

describe('the lines under the stencil (Taunya’s ask of 2026-11-15)', () => {
  it('breaks the address after /B/, so the link is no wider than its code', () => {
    expect(tapeAddressLines('PRTS.CO/B/849F-DB0B')).toEqual(['PRTS.CO/B/', '849F-DB0B'])
    expect(tapeAddressLines('prts.co/b/849f-db0b')).toEqual(['prts.co/b/', '849f-db0b'])
    // the two lines read back as the address that was printed on one
    expect(tapeAddressLines('PRTS.CO/B/849F-DB0B').join('')).toBe('PRTS.CO/B/849F-DB0B')
    // the test strip's address carries no code and stays whole
    expect(tapeAddressLines('PRTS.CO/B')).toEqual(['PRTS.CO/B'])
    expect(tapeAddressLines('PRTS.CO/B/')).toEqual(['PRTS.CO/B/'])
  })

  it('a box’s strip has the two lines of its address and no line of words', () => {
    expect(tapeStripLines('PRTS.CO/B/849F-DB0B')).toEqual([{ text: 'PRTS.CO/B/', kind: 'code' }, { text: '849F-DB0B', kind: 'code' }])
    expect(tapeStripLines('PRTS.CO/B/849F-DB0B', '')).toHaveLength(2)
    expect(tapeStripLines('PRTS.CO/B/849F-DB0B').some((line) => /scan/i.test(line.text))).toBe(false)
    // the test strip keeps its own words, so nobody takes it for a sticker
    expect(tapeStripLines('PRTS.CO/B', 'Test strip')).toEqual([{ text: 'PRTS.CO/B', kind: 'code' }, { text: 'Test strip', kind: 'words' }])
  })

  it('sets the code under the first line in the same type, the block centred and inside the tape', () => {
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      const block = tapeStripBlock(l, tapeStripLines('PRTS.CO/B/849F-DB0B'))
      const [first, code] = block.lines
      expect(first!.px).toBe(l.codePx)
      expect(code!.px).toBe(l.codePx)
      // the stencil's capitals start inside the tape, and the code's line ends inside it
      expect(block.stencilBaseline - l.stencilPx * 0.78).toBeGreaterThanOrEqual(0)
      expect(first!.baseline).toBeGreaterThan(block.stencilBaseline + first!.px)
      expect(code!.baseline - first!.baseline).toBeGreaterThanOrEqual(code!.px)
      expect(code!.baseline + code!.px * 0.25).toBeLessThanOrEqual(dots)
      // centred: the room over the stencil and under the code differ by less than a line
      const over = block.stencilBaseline - l.stencilPx * 0.78
      const under = dots - code!.baseline
      expect(Math.abs(over - under)).toBeLessThan(l.codePx)
    }
  })

  it('the test strip sits where it sat: its address, then its words a line under', () => {
    const l = tapeStripLayout(128, 25)
    const block = tapeStripBlock(l, tapeStripLines('PRTS.CO/B', 'Test strip'))
    expect(block.stencilBaseline).toBe(72)
    expect(block.lines.map((line) => [line.kind, line.px, line.baseline])).toEqual([['code', 17, 96], ['words', 13, 112]])
  })
})

describe('a sticker’s strip (punch list #329; v2.7438, no running number on the tape)', () => {
  it('a named sticker’s lines are a box label’s: the address on two lines, nothing over them but the name', () => {
    expect(tapeStripLines('PRTS.CO/B/4F2A-9C18')).toEqual([{ text: 'PRTS.CO/B/', kind: 'code' }, { text: '4F2A-9C18', kind: 'code' }])
    expect(tapeStripLines('PRTS.CO/B/4F2A-9C18', undefined, false)).toEqual(tapeStripLines('PRTS.CO/B/4F2A-9C18'))
  })

  it('a sticker with no name draws its code larger, since the code is all it reads', () => {
    expect(tapeStripLines('PRTS.CO/B/4F2A-9C18', undefined, true)).toEqual([{ text: 'PRTS.CO/B/', kind: 'code' }, { text: '4F2A-9C18', kind: 'code', big: true }])
    // the test strip's bare address has no code to enlarge
    expect(tapeStripLines('PRTS.CO/B', 'Test strip', true)).toEqual([{ text: 'PRTS.CO/B', kind: 'code' }, { text: 'Test strip', kind: 'words' }])
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      expect(bigCodeSquare(l)).toBe(3)
      const block = tapeStripBlock(l, tapeStripLines('PRTS.CO/B/4F2A-9C18', undefined, true), 0)
      const [first, code] = block.lines
      expect([first!.square, code!.square]).toEqual([2, 3])
      // the link's capitals are 14 dots, the code's 21, six dots between, the two centred on the tape
      expect(code!.baseline - first!.baseline).toBe(6 + dotTextHeight(3))
      const top = first!.baseline - dotTextHeight(2)
      const under = dots - code!.baseline
      expect(top).toBeGreaterThan(0)
      expect(Math.abs(top - under)).toBeLessThanOrEqual(1)
    }
  })

  it('a name of five to seven characters is drawn at five sevenths of the size, the block centred again', () => {
    const lines = tapeStripLines('PRTS.CO/B/4F2A-9C18')
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      const small = tapeStencilPx(l, true)
      expect(small).toBe(Math.round((l.stencilPx * 5) / 7))
      expect(tapeStencilPx(l)).toBe(l.stencilPx)
      const block = tapeStripBlock(l, lines, small)
      const over = block.stencilBaseline - small * 0.78
      const under = dots - block.lines[1]!.baseline
      expect(over).toBeGreaterThanOrEqual(0)
      expect(under).toBeGreaterThanOrEqual(0)
      expect(Math.abs(over - under)).toBeLessThan(l.codePx)
    }
  })

  it('a named strip is placed dot for dot as a box label is', () => {
    const l = tapeStripLayout(128, 25)
    const block = tapeStripBlock(l, tapeStripLines('PRTS.CO/B/4F2A-9C18'))
    expect(block.lines.map((line) => [line.square, line.baseline - block.stencilBaseline])).toEqual([[2, 24], [2, 45]])
  })
})

describe('the QR as squares', () => {
  it('reads the library’s runs, both spellings, into a grid', () => {
    const grid = qrSquaresFromPath('M0 0h3v1H0zM4,0 h1v1H4zM1 2h2v1H1z', 5)
    expect(grid[0]).toEqual([true, true, true, false, true])
    expect(grid[1]).toEqual([false, false, false, false, false])
    expect(grid[2]).toEqual([false, true, true, false, false])
  })

  it('reads a box label’s code as 25 squares with its three finder patterns', () => {
    const grid = qrSquares('HTTPS://PRTS.CO/B/B365B514')!
    expect(grid).toHaveLength(25)
    expect(grid.every((row) => row.length === 25)).toBe(true)
    // a finder pattern: a dark 7 x 7 ring with a light ring inside and a dark 3 x 3 heart
    for (const [x, y] of [[0, 0], [18, 0], [0, 18]] as const) {
      expect(grid[y]!.slice(x, x + 7).every(Boolean)).toBe(true)
      expect(grid[y + 1]!.slice(x + 1, x + 6).some(Boolean)).toBe(false)
      expect(grid[y + 3]![x + 3]).toBe(true)
    }
    // the fourth corner has none
    expect(grid[24]!.slice(18).every(Boolean)).toBe(false)
  })

  it('is the same grid every time for the same words, and another for other words', () => {
    const a = JSON.stringify(qrSquares('HTTPS://PRTS.CO/B/B365B514'))
    expect(JSON.stringify(qrSquares('HTTPS://PRTS.CO/B/B365B514'))).toBe(a)
    expect(JSON.stringify(qrSquares('HTTPS://PRTS.CO/B/E6A12139'))).not.toBe(a)
  })
})
