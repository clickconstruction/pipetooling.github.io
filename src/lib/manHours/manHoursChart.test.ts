import { describe, expect, it } from 'vitest'
import { buildManHoursPeriods, manHoursPeriodShortLabel, type ManHoursEntry } from './manHoursByPeriod'
import {
  buildManHoursBars,
  buildManHoursShareLine,
  manHoursAxis,
  manHoursLabeledColumns,
  manHoursHeadlineWords,
  pickManHoursHeadline,
  type ManHoursChartBox,
} from './manHoursChart'

const entry = (workDate: string, side: ManHoursEntry['side'], hours: number, userId = 'u1'): ManHoursEntry => ({ workDate, userId, side, hours, pending: false })

const BOX: ManHoursChartBox = { width: 700, height: 220, left: 50, right: 10, top: 10, bottom: 10 }

/** Aug: 300 field, 100 office. Sep: 300 field, 60 office, 40 bids, 20 on no job. Oct (open): 40 field. */
const months = (todayYmd = '2026-10-04') =>
  buildManHoursPeriods({
    zoom: 'month',
    todayYmd,
    entries: [
      entry('2026-08-01', 'field', 300),
      entry('2026-08-03', 'office', 100),
      entry('2026-09-10', 'field', 300),
      entry('2026-09-11', 'office', 60),
      entry('2026-09-12', 'bid', 40),
      entry('2026-09-13', 'unassigned', 20),
      entry('2026-10-02', 'field', 40),
    ],
  }).periods

describe('manHoursAxis', () => {
  it('picks a round top in at most five steps', () => {
    expect(manHoursAxis(2551)).toEqual({ max: 3000, step: 1000, ticks: [0, 1000, 2000, 3000] })
    expect(manHoursAxis(394)).toEqual({ max: 400, step: 100, ticks: [0, 100, 200, 300, 400] })
    expect(manHoursAxis(12119).max).toBe(12500)
    expect(manHoursAxis(420).ticks).toEqual([0, 100, 200, 300, 400, 500])
  })

  it('still gives an axis with nothing to hold', () => {
    const axis = manHoursAxis(0)
    expect(axis.max).toBeGreaterThan(0)
    expect(axis.ticks[0]).toBe(0)
  })
})

describe('buildManHoursBars', () => {
  it('stacks field, office, bids and not on a job from the baseline up to the total', () => {
    const periods = months()
    const { axis, baseline, yOf, columns } = buildManHoursBars(periods, BOX)
    expect(axis.max).toBe(500)
    expect(baseline).toBe(210)
    const sep = columns[1]
    expect(sep?.segments.map((s) => s.side)).toEqual(['field', 'office', 'bid', 'unassigned'])
    expect(sep?.segments.map((s) => s.top)).toEqual([false, false, false, true])
    // Each segment sits on the one below; the top of the stack is the total.
    expect(sep?.segments[0]?.y).toBeCloseTo(yOf(300))
    expect((sep?.segments[0]?.y ?? 0) + (sep?.segments[0]?.height ?? 0)).toBeCloseTo(baseline)
    expect(sep?.segments[3]?.y).toBeCloseTo(yOf(420))
    expect(sep?.segments.reduce((sum, s) => sum + s.height, 0)).toBeCloseTo(baseline - yOf(420))
  })

  it('leaves out a side with no hours and rounds the last one', () => {
    const aug = buildManHoursBars(months(), BOX).columns[0]
    expect(aug?.segments.map((s) => [s.side, s.top])).toEqual([
      ['field', false],
      ['office', true],
    ])
  })

  it('gives each period an equal slot and centers a bar no wider than 46', () => {
    const { columns } = buildManHoursBars(months(), BOX)
    expect(columns.map((c) => c.slotX)).toEqual([50, 50 + 640 / 3, 50 + (640 / 3) * 2])
    expect(columns[0]?.barWidth).toBe(46)
    expect((columns[0]?.barX ?? 0) + 23).toBeCloseTo(columns[0]?.centerX ?? -1)
  })

  it('puts a band behind the bar, a little wider than it and never wider than the slot', () => {
    const wideSlots = buildManHoursBars(months(), BOX).columns[0]
    expect(wideSlots?.bandWidth).toBe(62)
    expect((wideSlots?.bandX ?? 0) + 31).toBeCloseTo(wideSlots?.centerX ?? -1)

    // Thirteen weeks on a phone: 20px slots, a 12px bar, a band that stops inside the slot.
    const weeks = buildManHoursPeriods({
      zoom: 'week',
      todayYmd: '2026-09-30',
      entries: [entry('2026-07-06', 'field', 8), entry('2026-09-29', 'field', 8)],
    }).periods
    const narrow = buildManHoursBars(weeks, { ...BOX, width: 320 }).columns[0]
    expect(weeks).toHaveLength(13)
    expect(narrow?.slotWidth).toBe(20)
    expect(narrow?.barWidth).toBeCloseTo(12.4)
    expect(narrow?.bandWidth).toBe(18)
  })
})

describe('manHoursLabeledColumns', () => {
  const marks = (flags: boolean[]) => flags.map((f) => (f ? 'x' : '.')).join('')

  it('names every column when there is room', () => {
    expect(marks(manHoursLabeledColumns(8, 90, 'month'))).toBe('xxxxxxxx')
  })

  it('names every nth on a narrow chart, counted back from the newest', () => {
    // 20px slots and "Sep 27" needs 46: every third.
    expect(marks(manHoursLabeledColumns(13, 20, 'week'))).toBe('x..x..x..x..x')
  })

  it('always names a picked column, and a regular label too close to it steps aside', () => {
    // Column 11 is picked: the newest (12) is one slot away and gives way; 9 is two away and gives way too.
    expect(marks(manHoursLabeledColumns(13, 20, 'week', [11]))).toBe('x..x..x....x.')
    // Picking a column that already carries a label changes nothing.
    expect(marks(manHoursLabeledColumns(13, 20, 'week', [12]))).toBe('x..x..x..x..x')
  })
})

describe('buildManHoursShareLine', () => {
  it('puts a point on each period with a share and labels the first and the last finished one', () => {
    const line = buildManHoursShareLine(months(), BOX)
    expect(line.max).toBe(0.5)
    expect(line.ticks).toEqual([0, 0.25, 0.5])
    expect(line.points.map((p) => [p.key, Math.round(p.share * 100), p.soFar, p.labeled])).toEqual([
      ['2026-08-01', 25, false, true],
      ['2026-09-01', 25, false, true],
      ['2026-10-01', 0, true, false],
    ])
    expect(line.points[0]?.y).toBeCloseTo(line.yOf(0.25))
    expect(line.points[2]?.y).toBeCloseTo(210)
  })

  it('skips a period with no share and widens to 100% once a period passes half', () => {
    const periods = buildManHoursPeriods({
      zoom: 'week',
      todayYmd: '2026-09-22',
      entries: [entry('2026-09-01', 'office', 8), entry('2026-09-21', 'field', 4)],
    }).periods
    const line = buildManHoursShareLine(periods, BOX)
    expect(line.max).toBe(1)
    expect(line.points.map((p) => p.key)).toEqual(['2026-08-30', '2026-09-20'])
  })
})

describe('the headline', () => {
  it('reads the newest finished period against the one before it', () => {
    const picked = pickManHoursHeadline(months())
    expect(picked?.period.key).toBe('2026-09-01')
    expect(picked?.prior?.key).toBe('2026-08-01')
    expect(picked && manHoursHeadlineWords(picked, 'month')).toEqual({
      lead: 'September 2026:',
      rest: '420 hours. Office share 25%, the same as the month before.',
    })
  })

  it('says which way the share moved', () => {
    const periods = buildManHoursPeriods({
      zoom: 'quarter',
      todayYmd: '2026-10-04',
      entries: [entry('2026-04-10', 'field', 60), entry('2026-04-11', 'office', 40), entry('2026-07-10', 'field', 70), entry('2026-07-11', 'office', 30)],
    }).periods
    const picked = pickManHoursHeadline(periods)
    expect(picked && manHoursHeadlineWords(picked, 'quarter').rest).toBe('100 hours. Office share 30%, down from 40% the quarter before.')
  })

  it('reads the open period when nothing is finished yet', () => {
    const periods = buildManHoursPeriods({ zoom: 'year', todayYmd: '2026-10-04', entries: [entry('2026-03-12', 'field', 75), entry('2026-03-13', 'office', 25)] }).periods
    const picked = pickManHoursHeadline(periods)
    expect(picked?.open).toBe(true)
    expect(picked && manHoursHeadlineWords(picked, 'year')).toEqual({ lead: '2026 so far:', rest: '100 hours. Office share 25%.' })
  })

  it('is nothing with no periods', () => {
    expect(pickManHoursHeadline([])).toBeNull()
  })
})

describe('manHoursPeriodShortLabel', () => {
  it('names a period for the chart axis', () => {
    expect(manHoursPeriodShortLabel({ start: '2026-09-27' }, 'week')).toBe('Sep 27')
    expect(manHoursPeriodShortLabel({ start: '2026-09-01' }, 'month')).toBe('Sep')
    expect(manHoursPeriodShortLabel({ start: '2026-07-01' }, 'quarter')).toBe('Q3')
    expect(manHoursPeriodShortLabel({ start: '2026-01-01' }, 'year')).toBe('2026')
  })
})
