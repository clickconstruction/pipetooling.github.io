import { describe, expect, it } from 'vitest'
import { subOwedBands, subOwedChip, subOwedDayWords, subOwedJobWords, subOwedPlace, subOwedShapeFlagFromSearch, withSubOwedShape, type SubOwedSheet } from './subOwedBands'

const NEXT_RUN = '2026-10-31'

function sheet(p: Partial<SubOwedSheet> & { id: string }): SubOwedSheet {
  return { jobNumber: null, address: null, stage: 'customer_pay', open: 100, payableAfter: null, ...p }
}

describe('subOwedPlace — one rule for the head and the chip', () => {
  it('money with a date on or before the next run is in the next run, whatever the stage', () => {
    expect(subOwedPlace(sheet({ id: 'a', stage: 'working', payableAfter: '2026-10-30' }), NEXT_RUN)).toEqual({ band: 'next_run', ymd: NEXT_RUN })
    expect(subOwedPlace(sheet({ id: 'b', stage: 'customer_pay', payableAfter: NEXT_RUN }), NEXT_RUN)).toEqual({ band: 'next_run', ymd: NEXT_RUN })
  })

  it('a date after the next run is later, with its own day', () => {
    expect(subOwedPlace(sheet({ id: 'c', payableAfter: '2026-12-15' }), NEXT_RUN)).toEqual({ band: 'later', ymd: '2026-12-15' })
  })

  it('no date is later with no day; no run on the calendar makes everything later', () => {
    expect(subOwedPlace(sheet({ id: 'd', stage: 'working' }), NEXT_RUN)).toEqual({ band: 'later', ymd: null })
    expect(subOwedPlace(sheet({ id: 'e', payableAfter: '2026-10-30' }), null)).toEqual({ band: 'later', ymd: '2026-10-30' })
    expect(subOwedPlace(sheet({ id: 'f', payableAfter: 'soon' }), NEXT_RUN)).toEqual({ band: 'later', ymd: null })
  })

  it('nothing open is nowhere', () => {
    expect(subOwedPlace(sheet({ id: 'g', open: 0, payableAfter: '2026-10-30' }), NEXT_RUN)).toBeNull()
  })
})

describe('subOwedChip — the card says what the head says', () => {
  it('names the run day for money in the run, the sheet’s own day for money later, and nothing without a date', () => {
    expect(subOwedChip(sheet({ id: 'a', stage: 'working', payableAfter: '2026-10-30' }), NEXT_RUN)).toEqual({ kind: 'next_run', ymd: NEXT_RUN })
    expect(subOwedChip(sheet({ id: 'b', payableAfter: '2026-12-15' }), NEXT_RUN)).toEqual({ kind: 'later', ymd: '2026-12-15' })
    expect(subOwedChip(sheet({ id: 'c' }), NEXT_RUN)).toBeNull()
    expect(subOwedChip(sheet({ id: 'd', open: 0, payableAfter: '2026-10-30' }), NEXT_RUN)).toBeNull()
  })
})

describe('subOwedBands — the head as its rows', () => {
  const sheets: SubOwedSheet[] = [
    sheet({ id: 's1318', jobNumber: '1318', address: 'Sample Retail Shell', open: 1100, payableAfter: '2026-12-15' }),
    sheet({ id: 's1321', jobNumber: '1321', address: 'Cedar Bend, building C', stage: 'working', open: 1400, payableAfter: '2026-10-30' }),
    sheet({ id: 's1319', jobNumber: '1319', address: 'Hillcrest · Office remodel', open: 1000, payableAfter: '2026-10-31' }),
    sheet({ id: 's1330', jobNumber: '1330', address: 'Undated', stage: 'walkthrough', open: 250 }),
    sheet({ id: 'paid', jobNumber: '1300', open: 0, payableAfter: '2026-10-30' }),
  ]

  it('draws the mock-up: Friday’s two rows summed, the later rows in payable-after order, undated last', () => {
    const bands = subOwedBands(sheets, NEXT_RUN, 3750)
    expect(bands.total).toBe(3750)
    expect(bands.nextRun).toEqual({
      ymd: NEXT_RUN,
      rows: [
        { id: 's1321', jobWords: '1321 Cedar Bend, building C', amount: 1400, ymd: '2026-10-30' },
        { id: 's1319', jobWords: '1319 Hillcrest · Office remodel', amount: 1000, ymd: '2026-10-31' },
      ],
      sum: 2400,
    })
    expect(bands.later.rows.map((r) => [r.id, r.amount, r.ymd])).toEqual([
      ['s1318', 1100, '2026-12-15'],
      ['s1330', 250, null],
    ])
    expect(bands.later.sum).toBe(1350)
    expect(bands.unplaced).toBe(0)
  })

  it('money the head counts on no open sheet is named, never hidden', () => {
    expect(subOwedBands(sheets, NEXT_RUN, 4000).unplaced).toBe(250)
    expect(subOwedBands(sheets, NEXT_RUN, 3000).unplaced).toBe(0)
  })

  it('with no run on the calendar there is no next-run band and everything is later', () => {
    const bands = subOwedBands(sheets, null, 3750)
    expect(bands.nextRun).toBeNull()
    expect(bands.later.rows.map((r) => r.id)).toEqual(['s1321', 's1319', 's1318', 's1330'])
  })

  it('a sheet with no number or address falls back to the portal’s word', () => {
    expect(subOwedJobWords({ jobNumber: null, address: null }, 'Work order')).toBe('Work order')
    expect(subOwedJobWords({ jobNumber: ' 1321 ', address: null }, 'Work order')).toBe('1321')
    expect(subOwedJobWords({ jobNumber: null, address: 'Cedar Bend' }, 'Work order')).toBe('Cedar Bend')
  })
})

describe('subOwedShapeFlagFromSearch / withSubOwedShape — the office door carries the flag', () => {
  it('reads the page’s own flag and appends it to the portal link, keeping the hash', () => {
    expect(subOwedShapeFlagFromSearch('?tab=subs&sbs=1')).toBe('sbs')
    expect(subOwedShapeFlagFromSearch('?shape=1')).toBe('shape')
    expect(subOwedShapeFlagFromSearch('?tab=subs')).toBeNull()
    expect(withSubOwedShape('/sub?t=abc#card', 'shape')).toBe('/sub?t=abc&shape=1#card')
    expect(withSubOwedShape('/sub', 'sbs')).toBe('/sub?sbs=1')
    expect(withSubOwedShape('/sub?t=abc', null)).toBe('/sub?t=abc')
  })
})

describe('subOwedDayWords', () => {
  it('names a day in either language, with or without its weekday', () => {
    expect(subOwedDayWords('2026-10-31', 'en')).toBe('Oct 31')
    expect(subOwedDayWords('2026-10-30', 'en', { weekday: true })).toBe('Fri Oct 30')
    expect(subOwedDayWords('2026-12-15', 'es')).toBe('15 dic')
    expect(subOwedDayWords('2026-10-30', 'es', { weekday: true })).toBe('vie 30 oct')
    expect(subOwedDayWords(null, 'en')).toBe('')
    expect(subOwedDayWords('2026-10-31T12:00:00Z', 'en')).toBe('')
  })
})
