import { describe, it, expect } from 'vitest'
import {
  buildSpecificForecastColumns,
  visibleDaysForStage,
  FORECAST_SPECIFIC_MAX_VISIBLE_DAYS_PER_STAGE,
} from './projectsForecastSpecificColumns'

describe('visibleDaysForStage', () => {
  it('same-day stage returns 1 day', () => {
    expect(visibleDaysForStage('2026-04-01', '2026-04-01')).toEqual(['2026-04-01'])
  })

  it('5-day stage returns all 5 days', () => {
    expect(visibleDaysForStage('2026-04-01', '2026-04-05')).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-03',
      '2026-04-04',
      '2026-04-05',
    ])
    expect(FORECAST_SPECIFIC_MAX_VISIBLE_DAYS_PER_STAGE).toBe(5)
  })

  it('6-day stage returns first 2 + last 2 days', () => {
    expect(visibleDaysForStage('2026-04-01', '2026-04-06')).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-05',
      '2026-04-06',
    ])
  })

  it('30-day stage returns 4 days (first 2 + last 2)', () => {
    expect(visibleDaysForStage('2026-04-01', '2026-04-30')).toEqual([
      '2026-04-01',
      '2026-04-02',
      '2026-04-29',
      '2026-04-30',
    ])
  })

  it('end < start defensively returns 1 day at start', () => {
    expect(visibleDaysForStage('2026-04-10', '2026-04-01')).toEqual(['2026-04-10'])
  })

  it('malformed YMDs defensively return 1 day at start', () => {
    expect(visibleDaysForStage('whatever', '2026-04-05')).toEqual(['whatever'])
    expect(visibleDaysForStage('2026-04-01', 'whatever')).toEqual(['2026-04-01'])
  })

  it('handles month boundary in a 5-day stage', () => {
    expect(visibleDaysForStage('2026-04-29', '2026-05-02')).toEqual([
      '2026-04-29',
      '2026-04-30',
      '2026-05-01',
      '2026-05-02',
    ])
  })
})

describe('buildSpecificForecastColumns', () => {
  it('empty stage list returns empty result', () => {
    const r = buildSpecificForecastColumns([])
    expect(r.columns).toEqual([])
    expect(r.stageSpans).toEqual([])
    expect(r.dayKeyIndex.size).toBe(0)
  })

  it('single 1-day stage yields 1 column, span 0/0', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-01' },
    ])
    expect(r.columns).toEqual([{ kind: 'day', ymd: '2026-04-01' }])
    expect(r.stageSpans).toEqual([{ stageId: 'A', startColIdx: 0, endColIdx: 0 }])
  })

  it('single 5-day stage yields 5 day columns, span 0/4, no ellipsis', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-05' },
    ])
    expect(r.columns).toHaveLength(5)
    expect(r.columns.every((c) => c.kind === 'day')).toBe(true)
    expect(r.stageSpans).toEqual([{ stageId: 'A', startColIdx: 0, endColIdx: 4 }])
  })

  it('single 6-day stage yields day,day,ellipsis,day,day with span 0/4', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-06' },
    ])
    expect(r.columns).toEqual([
      { kind: 'day', ymd: '2026-04-01' },
      { kind: 'day', ymd: '2026-04-02' },
      {
        kind: 'ellipsis',
        daysCollapsed: 2,
        firstHiddenYmd: '2026-04-03',
        lastHiddenYmd: '2026-04-04',
      },
      { kind: 'day', ymd: '2026-04-05' },
      { kind: 'day', ymd: '2026-04-06' },
    ])
    expect(r.stageSpans).toEqual([{ stageId: 'A', startColIdx: 0, endColIdx: 4 }])
  })

  it('two adjacent stages (B starts where A ends) share no ellipsis between them', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-05' },
      { stageId: 'B', startYmd: '2026-04-06', endYmd: '2026-04-10' },
    ])
    expect(r.columns).toHaveLength(10)
    expect(r.columns.every((c) => c.kind === 'day')).toBe(true)
    expect(r.stageSpans).toEqual([
      { stageId: 'A', startColIdx: 0, endColIdx: 4 },
      { stageId: 'B', startColIdx: 5, endColIdx: 9 },
    ])
  })

  it('two stages with a multi-day gap collapse the gap into one ellipsis column', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-02' },
      { stageId: 'B', startYmd: '2026-04-20', endYmd: '2026-04-21' },
    ])
    expect(r.columns).toEqual([
      { kind: 'day', ymd: '2026-04-01' },
      { kind: 'day', ymd: '2026-04-02' },
      {
        kind: 'ellipsis',
        daysCollapsed: 17,
        firstHiddenYmd: '2026-04-03',
        lastHiddenYmd: '2026-04-19',
      },
      { kind: 'day', ymd: '2026-04-20' },
      { kind: 'day', ymd: '2026-04-21' },
    ])
    expect(r.stageSpans).toEqual([
      { stageId: 'A', startColIdx: 0, endColIdx: 1 },
      { stageId: 'B', startColIdx: 3, endColIdx: 4 },
    ])
  })

  it("user-example: S1(Aug1→Jan26) + S2(Jan27→Feb3) + S3(Feb4) builds 11 cols with two ellipsis runs", () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'S1', startYmd: '2026-08-01', endYmd: '2027-01-26' },
      { stageId: 'S2', startYmd: '2027-01-27', endYmd: '2027-02-03' },
      { stageId: 'S3', startYmd: '2027-02-04', endYmd: '2027-02-04' },
    ])
    expect(r.columns).toHaveLength(11)
    expect(r.columns[0]).toEqual({ kind: 'day', ymd: '2026-08-01' })
    expect(r.columns[1]).toEqual({ kind: 'day', ymd: '2026-08-02' })
    expect(r.columns[2]).toMatchObject({
      kind: 'ellipsis',
      firstHiddenYmd: '2026-08-03',
      lastHiddenYmd: '2027-01-24',
    })
    expect(r.columns[3]).toEqual({ kind: 'day', ymd: '2027-01-25' })
    expect(r.columns[4]).toEqual({ kind: 'day', ymd: '2027-01-26' })
    expect(r.columns[5]).toEqual({ kind: 'day', ymd: '2027-01-27' })
    expect(r.columns[6]).toEqual({ kind: 'day', ymd: '2027-01-28' })
    expect(r.columns[7]).toEqual({
      kind: 'ellipsis',
      daysCollapsed: 4,
      firstHiddenYmd: '2027-01-29',
      lastHiddenYmd: '2027-02-01',
    })
    expect(r.columns[8]).toEqual({ kind: 'day', ymd: '2027-02-02' })
    expect(r.columns[9]).toEqual({ kind: 'day', ymd: '2027-02-03' })
    expect(r.columns[10]).toEqual({ kind: 'day', ymd: '2027-02-04' })

    expect(r.stageSpans).toEqual([
      { stageId: 'S1', startColIdx: 0, endColIdx: 4 },
      { stageId: 'S2', startColIdx: 5, endColIdx: 9 },
      { stageId: 'S3', startColIdx: 10, endColIdx: 10 },
    ])
  })

  it("overlapping stages: inner stage's visible day punches through outer's hidden middle", () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-01-01', endYmd: '2026-03-01' },
      { stageId: 'B', startYmd: '2026-02-10', endYmd: '2026-02-10' },
    ])
    expect(r.columns).toHaveLength(7)
    expect(r.columns[0]).toEqual({ kind: 'day', ymd: '2026-01-01' })
    expect(r.columns[1]).toEqual({ kind: 'day', ymd: '2026-01-02' })
    expect(r.columns[2]!.kind).toBe('ellipsis')
    expect(r.columns[3]).toEqual({ kind: 'day', ymd: '2026-02-10' })
    expect(r.columns[4]!.kind).toBe('ellipsis')
    expect(r.columns[5]).toEqual({ kind: 'day', ymd: '2026-02-28' })
    expect(r.columns[6]).toEqual({ kind: 'day', ymd: '2026-03-01' })
    expect(r.stageSpans).toEqual([
      { stageId: 'A', startColIdx: 0, endColIdx: 6 },
      { stageId: 'B', startColIdx: 3, endColIdx: 3 },
    ])
  })

  it('dayKeyIndex maps every day column to its index and excludes ellipsis cols', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-06' },
    ])
    expect(r.dayKeyIndex.get('2026-04-01')).toBe(0)
    expect(r.dayKeyIndex.get('2026-04-02')).toBe(1)
    expect(r.dayKeyIndex.get('2026-04-05')).toBe(3)
    expect(r.dayKeyIndex.get('2026-04-06')).toBe(4)
    expect(r.dayKeyIndex.get('2026-04-03')).toBeUndefined()
    expect(r.dayKeyIndex.get('2026-04-04')).toBeUndefined()
    expect(r.dayKeyIndex.size).toBe(4)
  })

  it('handles year boundary in adjacent stages', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-12-29', endYmd: '2026-12-30' },
      { stageId: 'B', startYmd: '2027-01-01', endYmd: '2027-01-02' },
    ])
    expect(r.columns).toEqual([
      { kind: 'day', ymd: '2026-12-29' },
      { kind: 'day', ymd: '2026-12-30' },
      {
        kind: 'ellipsis',
        daysCollapsed: 1,
        firstHiddenYmd: '2026-12-31',
        lastHiddenYmd: '2026-12-31',
      },
      { kind: 'day', ymd: '2027-01-01' },
      { kind: 'day', ymd: '2027-01-02' },
    ])
  })

  it('two consecutive long stages collapse middles separately, no ellipsis between them', () => {
    const r = buildSpecificForecastColumns([
      { stageId: 'A', startYmd: '2026-04-01', endYmd: '2026-04-10' },
      { stageId: 'B', startYmd: '2026-04-11', endYmd: '2026-04-20' },
    ])
    expect(r.columns).toEqual([
      { kind: 'day', ymd: '2026-04-01' },
      { kind: 'day', ymd: '2026-04-02' },
      {
        kind: 'ellipsis',
        daysCollapsed: 6,
        firstHiddenYmd: '2026-04-03',
        lastHiddenYmd: '2026-04-08',
      },
      { kind: 'day', ymd: '2026-04-09' },
      { kind: 'day', ymd: '2026-04-10' },
      { kind: 'day', ymd: '2026-04-11' },
      { kind: 'day', ymd: '2026-04-12' },
      {
        kind: 'ellipsis',
        daysCollapsed: 6,
        firstHiddenYmd: '2026-04-13',
        lastHiddenYmd: '2026-04-18',
      },
      { kind: 'day', ymd: '2026-04-19' },
      { kind: 'day', ymd: '2026-04-20' },
    ])
    expect(r.stageSpans).toEqual([
      { stageId: 'A', startColIdx: 0, endColIdx: 4 },
      { stageId: 'B', startColIdx: 5, endColIdx: 9 },
    ])
  })
})
