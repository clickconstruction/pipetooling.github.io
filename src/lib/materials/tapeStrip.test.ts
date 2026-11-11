import { describe, expect, it } from 'vitest'

import { qrSquares, qrSquaresFromPath, tapeStripLayout } from './tapeStrip'

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

  it('keeps the words inside the strip', () => {
    for (const dots of [112, 128]) {
      const l = tapeStripLayout(dots, 25)
      expect(l.stencilPx + l.codePx * 1.2 + l.wordsPx * 1.2 + 6).toBeLessThanOrEqual(dots)
    }
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
