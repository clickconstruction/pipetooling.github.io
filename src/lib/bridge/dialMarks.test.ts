import { describe, expect, it } from 'vitest'
import { layMarkRows, markAnchor, markRowCount, markSpan } from './dialMarks'

/** The dial's four marks at a stage where they spread across the track, with widths read at 0.62rem. */
const FOUR = [
  { p: 0, widthPx: 115 }, // the pile stops growing
  { p: 24, widthPx: 30 }, // today
  { p: 31, widthPx: 128 }, // above here Collect is the link
  { p: 46, widthPx: 120 }, // another crew from here
]

describe('the dial’s mark rows', () => {
  it('hangs a label from its point: right of it at the left end, left of it at the right end, centred between', () => {
    expect(markAnchor(0)).toBe('start')
    expect(markAnchor(7.9)).toBe('start')
    expect(markAnchor(8)).toBe('centre')
    expect(markAnchor(92)).toBe('centre')
    expect(markAnchor(92.1)).toBe('end')
    expect(markSpan(0, 100, 400)).toEqual({ left: 0, right: 100 })
    expect(markSpan(50, 100, 400)).toEqual({ left: 150, right: 250 })
    expect(markSpan(100, 100, 400)).toEqual({ left: 300, right: 400 })
  })
  it('keeps two rows on a desk track where the labels clear each other', () => {
    // 600 px, read left to right: the pile (0–115), then the link (122–250) clears it on the first row; today (129–159)
    // sits under the link and drops; another crew (216–336) clears today on the second row.
    const rows = layMarkRows(FOUR, 600)
    expect(rows).toEqual([0, 1, 0, 1])
    expect(markRowCount(rows)).toBe(2)
  })
  it('spreads the same labels over more rows on a phone track instead of stacking them', () => {
    // 328 px: the pile (0–115); the link (38–166) drops; today (64–94) sits under both and drops again; another crew
    // (91–211) under all three drops once more. The old 16-point rule put them on two rows, on top of each other.
    const rows = layMarkRows(FOUR, 328)
    expect(rows).toEqual([0, 2, 1, 3])
    expect(markRowCount(rows)).toBe(4)
  })
  it('puts labels that clear each other on one row', () => {
    const rows = layMarkRows(
      [
        { p: 0, widthPx: 40 },
        { p: 50, widthPx: 40 },
        { p: 100, widthPx: 40 },
      ],
      400,
    )
    expect(rows).toEqual([0, 0, 0])
    expect(markRowCount(rows)).toBe(1)
  })
  it('answers in the marks’ order whatever their order on the track', () => {
    const rows = layMarkRows(
      [
        { p: 80, widthPx: 100 },
        { p: 10, widthPx: 100 },
        { p: 50, widthPx: 100 },
      ],
      300,
    )
    // On the track: p10 (−20–80) first, p50 (100–200) clears it, p80 (190–290) runs into p50 and drops.
    expect(rows).toEqual([1, 0, 0])
  })
  it('reads a gap of six pixels, so two labels edge to edge still part', () => {
    // On 200 px the second label is centred on 150, so it runs 100–200.
    expect(layMarkRows([{ p: 0, widthPx: 94 }, { p: 75, widthPx: 100 }], 200)).toEqual([0, 0])
    expect(layMarkRows([{ p: 0, widthPx: 95 }, { p: 75, widthPx: 100 }], 200)).toEqual([0, 1])
  })
  it('puts everything on the first row until the track is measured', () => {
    expect(layMarkRows(FOUR, 0)).toEqual([0, 0, 0, 0])
    expect(markRowCount([])).toBe(1)
  })
})
