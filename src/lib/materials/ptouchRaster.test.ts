import { describe, expect, it } from 'vitest'

import {
  PTOUCH_LINE_BYTES,
  cmdAutoCut,
  chainsToNext,
  cmdChainToNext,
  cmdFeedAndCutAfter,
  cmdInit,
  cmdMarginAndPlainLines,
  cmdPrintAndFeed,
  cmdPrintInfo,
  cmdRasterLine,
  cmdRasterMode,
  cmdStatusRequest,
  dotsToMm,
  inkWidth,
  labelPrintMs,
  parsePtouchStatus,
  ptouchLabelJob,
  ptouchReadyLine,
  ptouchTapeDots,
  ptouchTapeFits,
  rasterLinesFromRgba,
} from './ptouchRaster'

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ')

/** A drawing of `width` x `height`, white, with the listed [x, y] pixels black. */
function drawing(width: number, height: number, ink: ReadonlyArray<[number, number]>): Uint8ClampedArray {
  const px = new Uint8ClampedArray(width * height * 4).fill(255)
  for (const [x, y] of ink) px.set([0, 0, 0, 255], (y * width + x) * 4)
  return px
}

/** The status the PT-D610BT sent on 2026-11-10 with 24 mm laminated tape in it. */
const READY = Uint8Array.from('80 20 42 30 7c 30 00 00 00 00 18 01 00 00 00 00 00 00 00 00 00 00 00 00 01 08 00 00 00 00 00 00'.split(' ').map((h) => parseInt(h, 16)))

describe('the P-touch commands', () => {
  it('are the bytes the printer was proven on', () => {
    expect(cmdInit()).toHaveLength(102)
    expect(hex(cmdInit().slice(98))).toBe('00 00 1b 40')
    expect(hex(cmdStatusRequest())).toBe('1b 69 53')
    expect(hex(cmdRasterMode())).toBe('1b 69 61 01')
    // 24 mm tape, 342 lines (0x156), the page flag 2
    expect(hex(cmdPrintInfo(24, 342))).toBe('1b 69 7a 00 00 18 00 56 01 00 00 02 00')
    expect(hex(cmdMarginAndPlainLines())).toBe('1b 69 64 01 00 4d 00')
    expect(hex(cmdAutoCut())).toBe('1b 69 4d 40')
    expect(hex(cmdFeedAndCutAfter())).toBe('1b 69 4b 08')
    expect(hex(cmdPrintAndFeed())).toBe('1a')
  })

  it('wraps a raster line in G and its length', () => {
    const line = new Uint8Array(PTOUCH_LINE_BYTES).fill(0xff)
    const cmd = cmdRasterLine(line)
    expect(cmd).toHaveLength(19)
    expect(hex(cmd.slice(0, 3))).toBe('47 10 00')
  })

  it('lays one label out as one whole job that ends with print, feed and cut', () => {
    const lines = [new Uint8Array(16), new Uint8Array(16), new Uint8Array(16)]
    const job = ptouchLabelJob(lines, 24)
    expect(job.map((c) => c[0] === 0x47 ? 'line' : hex(c).slice(0, 8))).toEqual(['1b 69 61', '1b 69 7a', '1b 69 64', '1b 69 4d', '1b 69 4b', 'line', 'line', 'line', '1a'])
    expect(hex(job[1]!)).toBe('1b 69 7a 00 00 18 00 03 00 00 00 02 00')
  })
})

describe('rasterLinesFromRgba', () => {
  it('makes one 16-byte line a column, the bottom row on pin 0, pin 0 the lowest bit of the last byte', () => {
    // full head height: bottom-left pixel black, and the top pixel of the second column
    const lines = rasterLinesFromRgba(drawing(2, 128, [[0, 127], [1, 0]]), 2, 128)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toHaveLength(16)
    expect(lines[0]![15]).toBe(0x01)
    expect(lines[0]!.slice(0, 15).every((b) => b === 0)).toBe(true)
    expect(lines[1]![0]).toBe(0x80)
  })

  it('centres a drawing shorter than the head', () => {
    // 112 dots (18 mm tape): its bottom row lands on pin 8
    const lines = rasterLinesFromRgba(drawing(1, 112, [[0, 111]]), 1, 112)
    expect(lines[0]![14]).toBe(0x01)
    expect(lines[0]![15]).toBe(0x00)
  })

  it('reads grey and see-through pixels as blank', () => {
    const px = drawing(1, 128, [])
    px.set([200, 200, 200, 255], 0)
    px.set([0, 0, 0, 20], 4)
    expect(rasterLinesFromRgba(px, 1, 128)[0]!.every((b) => b === 0)).toBe(true)
  })
})

describe('inkWidth', () => {
  it('trims to the last column of ink plus the pad, never past the drawing', () => {
    expect(inkWidth(drawing(100, 4, [[30, 2]]), 100, 4)).toBe(45)
    expect(inkWidth(drawing(100, 4, [[95, 0]]), 100, 4)).toBe(100)
    expect(inkWidth(drawing(100, 4, []), 100, 4)).toBe(0)
  })
})

describe('parsePtouchStatus', () => {
  it('reads the tape, the status type and the phase from the reply the printer sent', () => {
    expect(parsePtouchStatus(READY)).toEqual({ tapeMm: 24, statusType: 0, phase: 0, errors: [] })
    const printing = Uint8Array.from(READY)
    printing[18] = 0x06
    printing[19] = 0x01
    expect(parsePtouchStatus(printing)).toMatchObject({ statusType: 6, phase: 1 })
  })

  it('names what is wrong, and refuses bytes that are not a status', () => {
    const open = Uint8Array.from(READY)
    open[9] = 0x10
    open[18] = 0x02
    expect(parsePtouchStatus(open)?.errors).toEqual(['The printer’s cover is open.'])
    const noTape = Uint8Array.from(READY)
    noTape[8] = 0x01
    noTape[10] = 0
    expect(parsePtouchStatus(noTape)?.errors).toEqual(['There is no tape in the printer.'])
    const odd = Uint8Array.from(READY)
    odd[18] = 0x02
    expect(parsePtouchStatus(odd)?.errors).toEqual(['The printer reported an error.'])
    expect(parsePtouchStatus(new Uint8Array(32))).toBeNull()
    expect(parsePtouchStatus(READY.slice(0, 20))).toBeNull()
  })
})

describe('the words and the sizes', () => {
  it('says the printer is ready, or what to load', () => {
    const ready = parsePtouchStatus(READY)!
    expect(ptouchReadyLine('PT-D610BT', ready)).toBe('PT-D610BT · 24 mm tape · ready')
    expect(ptouchTapeFits(ready)).toBe(true)
    expect(ptouchReadyLine('PT-D610BT', { ...ready, tapeMm: 12 })).toBe('PT-D610BT · 12 mm tape · load 18 or 24 mm tape for box labels')
    expect(ptouchTapeFits({ ...ready, tapeMm: 12 })).toBe(false)
    expect(ptouchReadyLine('PT-D610BT', { ...ready, tapeMm: 0 })).toBe('PT-D610BT · no tape')
    expect(ptouchReadyLine('PT-D610BT', { ...ready, errors: ['The printer’s cover is open.'] })).toBe('PT-D610BT · The printer’s cover is open.')
  })

  it('knows what each tape prints and how long a label takes', () => {
    expect(ptouchTapeDots(24)).toBe(128)
    expect(ptouchTapeDots(18)).toBe(112)
    expect(ptouchTapeDots(36)).toBeNull()
    expect(dotsToMm(180)).toBeCloseTo(25.4)
    // 363 lines is about 51 mm: about 5.3 seconds with the lead-in and the cut
    expect(labelPrintMs(363)).toBeGreaterThan(4500)
    expect(labelPrintMs(363)).toBeLessThan(6500)
  })

  it('a run chains every label but its last, so the strips share one lead-in', () => {
    expect(hex(cmdChainToNext())).toBe('1b 69 4b 00')
    expect([0, 1, 2].map((n) => chainsToNext(n, 3))).toEqual([true, true, false])
    expect(chainsToNext(0, 1)).toBe(false)
    const lines = [new Uint8Array(16), new Uint8Array(16)]
    const flat = (job: Uint8Array[]) => job.map(hex).join(' | ')
    // the same job, one byte apart: the last label feeds out and cuts, the others stay for the next
    expect(flat(ptouchLabelJob(lines, 24, true))).toBe(flat(ptouchLabelJob(lines, 24)).replace('1b 69 4b 08', '1b 69 4b 00'))
    expect(flat(ptouchLabelJob(lines, 24, false))).toContain('1b 69 4b 08')
  })
})
