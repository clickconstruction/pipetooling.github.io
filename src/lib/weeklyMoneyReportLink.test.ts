import { describe, expect, it } from 'vitest'
import { parseStagesMoneyWeekParam, weeklyMoneyReportHref } from './weeklyMoneyReportLink'

describe('weeklyMoneyReportHref', () => {
  it('pins the report to the picker week (2026-08-31 is a Monday)', () => {
    expect(weeklyMoneyReportHref('2026-08-31')).toBe('/jobs?tab=stages&stagesMoney=1&stagesMoneyWeek=2026-08-31')
  })

  it('normalizes a mid-week day to its Monday', () => {
    expect(weeklyMoneyReportHref('2026-09-03')).toBe('/jobs?tab=stages&stagesMoney=1&stagesMoneyWeek=2026-08-31')
  })

  it('drops the companion when the week is garbage — the report keeps its own default', () => {
    expect(weeklyMoneyReportHref('')).toBe('/jobs?tab=stages&stagesMoney=1')
    expect(weeklyMoneyReportHref('last week')).toBe('/jobs?tab=stages&stagesMoney=1')
  })
})

describe('parseStagesMoneyWeekParam', () => {
  it('accepts a real date and returns its Monday', () => {
    expect(parseStagesMoneyWeekParam('2026-08-31')).toBe('2026-08-31')
    expect(parseStagesMoneyWeekParam(' 2026-09-06 ')).toBe('2026-08-31')
  })

  it('rejects malformed, impossible, or missing values', () => {
    expect(parseStagesMoneyWeekParam(null)).toBeNull()
    expect(parseStagesMoneyWeekParam(undefined)).toBeNull()
    expect(parseStagesMoneyWeekParam('')).toBeNull()
    expect(parseStagesMoneyWeekParam('2026-8-31')).toBeNull()
    expect(parseStagesMoneyWeekParam('2026-02-31')).toBeNull()
    expect(parseStagesMoneyWeekParam('2026-13-01')).toBeNull()
    expect(parseStagesMoneyWeekParam('<script>')).toBeNull()
  })
})
