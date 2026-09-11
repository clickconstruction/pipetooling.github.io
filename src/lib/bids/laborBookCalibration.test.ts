import { describe, expect, it } from 'vitest'
import { bookMultiplier, bookMultiplierWords, calibratedEntryHours, calibrationExclusion, entryEvidence, type CalibrationJob } from './laborBookCalibration'
import type { LaborBookMatchEntry } from './laborBookMatch'

const each = { unit: 'each', kind: 'fixture' } as const
const book: LaborBookMatchEntry[] = [
  { id: 'e-toilet', name: 'Toilet', aliases: ['WC'], rough: 1, top: 1, trim: 1, ...each },
  { id: 'e-lav', name: 'Lavatory', aliases: ['LAV'], rough: 0.5, top: 0.5, trim: 0.5, ...each },
  { id: 'e-fd', name: 'Floor drain', aliases: ['FD'], rough: 1.5, top: 0, trim: 0.5, ...each },
]
const row = (fixture: string, count: number, hrs: [number, number, number]) => ({ fixture, count, is_fixed: false, rough_in_hrs_per_unit: hrs[0], top_out_hrs_per_unit: hrs[1], trim_set_hrs_per_unit: hrs[2] })

// The to-do's real pairs, illustrative hours: J650 ATI (339 h on $33.5k), J523 (549 h at 90 %), J804 (131 h at 80 %).
const j650: CalibrationJob = { jobId: 'j650', label: 'J650 ATI Schertz', bidId: 'b34', pctDone: 100, fieldDays: 22, actualHours: 339, rows: [row('WC', 20, [1, 1, 1]), row('LAV', 20, [0.5, 0.5, 0.5]), row('FD', 10, [1.5, 0, 0.5])] } // predicted 60 + 30 + 20 = 110... scaled below
const j523: CalibrationJob = { jobId: 'j523', label: 'J523 Mission Hills', bidId: 'b66', pctDone: 90, fieldDays: 41, actualHours: 549, rows: [row('WC', 100, [1, 1, 1]), row('LAV', 100, [0.5, 0.5, 0.5])] } // predicted 300 + 150 = 450 → to date 405
const j804: CalibrationJob = { jobId: 'j804', label: 'J804 AutoZone', bidId: 'b67', pctDone: 80, fieldDays: 12, actualHours: 131, rows: [row('WC', 30, [1, 1, 1]), row('FD', 20, [1.5, 0, 0.5])] } // predicted 90 + 40 = 130 → to date 104
const young: CalibrationJob = { jobId: 'j1007', label: 'J1007 SPACEX', bidId: 'b375', pctDone: 31, fieldDays: 3, actualHours: 43, rows: [row('WC', 10, [1, 1, 1])] }
const unpriced: CalibrationJob = { jobId: 'j879', label: 'J879 ADAMS', bidId: 'b76', pctDone: 100, fieldDays: 15, actualHours: 200, rows: [row('WC', 10, [0, 0, 0])] }

describe('bookMultiplier', () => {
  it('sums actual over predicted-to-date across the jobs that qualify, and names why the rest do not', () => {
    const m = bookMultiplier([j650, j523, j804, young, unpriced])
    expect(m.used.map((u) => u.job.jobId)).toEqual(['j650', 'j523', 'j804'])
    expect(m.excluded.map((e) => `${e.job.jobId}:${e.why}`)).toEqual(['j1007:under-8-days', 'j879:no-prediction'])
    // predicted-to-date: 110 + 405 + 104 = 619; actual: 339 + 549 + 131 = 1019
    expect(m.multiplier).toBeCloseTo(1019 / 619, 4)
    expect(m.used[1]).toMatchObject({ predictedHours: 450, predictedToDate: 405 })
    expect(m.used[1]!.ratio).toBeCloseTo(549 / 405, 4)
    expect(bookMultiplierWords(m)).toBe('book runs ×1.65 light · 3 jobs')
  })
  it('a job under 25 % says nothing; no hours says nothing; words for none', () => {
    expect(calibrationExclusion({ ...young, fieldDays: 20, pctDone: 20 }, 30)).toBe('under-25-pct')
    expect(calibrationExclusion({ ...young, actualHours: 0 }, 30)).toBe('no-hours')
    expect(bookMultiplierWords(bookMultiplier([]))).toBe('no linked jobs yet')
    expect(bookMultiplierWords(bookMultiplier([young]))).toBe('no job says yet — 1 linked but too young or unpriced')
    const heavy = bookMultiplier([{ ...j650, actualHours: 90 }])
    expect(bookMultiplierWords(heavy)).toBe('book runs ×0.82 heavy · 1 job')
  })
})

describe('entryEvidence', () => {
  it('attributes each job\'s actual hours to its rows by the book\'s own share and reads the spread', () => {
    const m = bookMultiplier([j650, j523, j804])
    const ev = entryEvidence(book, m.used)
    const toilet = ev.get('e-toilet')!
    expect(toilet.rows.map((r) => r.jobLabel)).toEqual(['J650 ATI Schertz', 'J523 Mission Hills', 'J804 AutoZone'])
    // J523: 300 of 450 predicted → 2/3 of 549 = 366 actual on toilets vs 270 predicted to date → 1.356
    const j523Row = toilet.rows.find((r) => r.jobId === 'j523')!
    expect(j523Row.predictedHours).toBe(300)
    expect(j523Row.actualShareHours).toBeCloseTo(366, 3)
    expect(j523Row.ratio).toBeCloseTo(366 / 270, 3)
    expect(toilet.spread).toBe('wide') // 3.08 (J650) vs 1.36 vs 1.26
    expect(toilet.words).toBe('3 jobs · wide')
    const fd = ev.get('e-fd')!
    expect(fd.rows.map((r) => r.jobId)).toEqual(['j650', 'j804'])
    expect(fd.medianRatio).not.toBeNull()
    expect(ev.get('e-lav')!.rows).toHaveLength(2)
  })
  it('an entry no linked job used reads "no jobs yet"', () => {
    const ev = entryEvidence(book, [])
    expect(ev.get('e-toilet')).toMatchObject({ rows: [], medianRatio: null, spread: 'none', words: 'no jobs yet' })
  })
})

describe('calibratedEntryHours', () => {
  it('scales the entry by the median ratio to the quarter hour', () => {
    expect(calibratedEntryHours({ rough: 1, top: 1, trim: 1 }, 1.18)).toEqual({ rough: 1.25, top: 1.25, trim: 1.25 })
    expect(calibratedEntryHours({ rough: 1.5, top: 0, trim: 0.5 }, 0.9)).toEqual({ rough: 1.25, top: 0, trim: 0.5 })
  })
})
