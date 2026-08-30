import { describe, it, expect } from 'vitest'
import {
  rawPxToBasePt,
  readablePtToRawPx,
  overviewBoxToRawRect,
  assembleTakeoff,
  validateTakeoff,
  countsVsSchedule,
} from './takeoffPlacement'

describe('rawPxToBasePt', () => {
  it('600 dpi → PDF points is ÷ 8.333…', () => {
    expect(rawPxToBasePt({ x: 600, y: 1200 }, 600)).toEqual({ x: 72, y: 144 })
  })
  it('72 dpi is identity', () => {
    expect(rawPxToBasePt({ x: 10, y: 20 }, 72)).toEqual({ x: 10, y: 20 })
  })
})

describe('readablePtToRawPx (90° CW rotated crop)', () => {
  const crop = { x: 100, y: 200, w: 400, h: 300 }
  it('readable origin (top-left) is the raw crop bottom-left', () => {
    expect(readablePtToRawPx({ x: 0, y: 0 }, crop)).toEqual({ x: 100, y: 500 })
  })
  it('readable top-right is the raw crop origin corner', () => {
    // readable width = crop.h → x_readable = crop.h at the right edge
    expect(readablePtToRawPx({ x: 300, y: 0 }, crop)).toEqual({ x: 100, y: 200 })
  })
  it('round-trips a known interior point', () => {
    // A raw point (150, 260): xr' = y - cropY = 60 from top after rotation…
    // readable coords: x_readable = crop.h - (y_raw - crop.y) = 300 - 60 = 240; y_readable = x_raw - crop.x = 50
    expect(readablePtToRawPx({ x: 240, y: 50 }, crop)).toEqual({ x: 150, y: 260 })
  })
})

describe('overviewBoxToRawRect', () => {
  it('matches EXTRACTOR.md math at 40→600 dpi (k=15)', () => {
    // Overview readable frame: page height at 40dpi = 500 readable-x units.
    const r = overviewBoxToRawRect({ x: 100, y: 40, w: 60, h: 80 }, 40, 600, 500)
    expect(r).toEqual({ x: 600, y: (500 - 160) * 15, w: 1200, h: 900 })
  })
})

describe('assembleTakeoff + validateTakeoff', () => {
  const counters = [{ id: 'c-wc1', name: 'WC-1' }]
  it('groups marks by page, converts to base points, sorts pages', () => {
    const t = assembleTakeoff({
      counters,
      marks: [
        { counterId: 'c-wc1', pageIndex: 5, raw: { x: 600, y: 600 }, dpi: 600 },
        { counterId: 'c-wc1', pageIndex: 2, raw: { x: 72, y: 72 }, dpi: 72 },
      ],
      pageScales: { 2: { pixelsPerUnit: 12.5, unit: 'ft' } },
    })
    expect(t.pages.map((p) => p.index)).toEqual([2, 5])
    expect(t.pages[0]!.counterMarkers!['c-wc1']).toEqual([{ x: 72, y: 72 }])
    expect(t.pages[1]!.counterMarkers!['c-wc1']).toEqual([{ x: 72, y: 72 }])
    expect(t.pages[0]!.scale).toEqual({ pixelsPerUnit: 12.5, unit: 'ft' })
    expect(validateTakeoff(t, 55)).toEqual([])
  })

  it('flags the same problems import-takeoff would, by name', () => {
    const t = assembleTakeoff({ counters, marks: [{ counterId: 'c-nope', pageIndex: 60, raw: { x: 0, y: 0 }, dpi: 600 }] })
    const problems = validateTakeoff(t, 55)
    expect(problems.some((p) => p.includes('unknown counter id c-nope'))).toBe(true)
    expect(problems.some((p) => p.includes("beyond the PDF's page count (55)"))).toBe(true)
  })
})

describe('countsVsSchedule', () => {
  it('scores placed vs scheduled, presence-only for qty null, and flags unscheduled tags', () => {
    const t = assembleTakeoff({
      counters: [
        { id: 'a', name: 'WC-1' },
        { id: 'b', name: 'MYSTERY-9' },
      ],
      marks: [
        { counterId: 'a', pageIndex: 0, raw: { x: 1, y: 1 }, dpi: 72 },
        { counterId: 'a', pageIndex: 0, raw: { x: 2, y: 2 }, dpi: 72 },
        { counterId: 'b', pageIndex: 0, raw: { x: 3, y: 3 }, dpi: 72 },
      ],
    })
    const rows = countsVsSchedule(t, [
      { tag: 'WC-1', qty: 2 },
      { tag: 'LAV-1', qty: null },
    ])
    expect(rows).toEqual([
      { tag: 'WC-1', placed: 2, scheduled: 2, ok: true },
      { tag: 'LAV-1', placed: 0, scheduled: null, ok: false },
      { tag: 'MYSTERY-9', placed: 1, scheduled: null, ok: false },
    ])
  })
})
