import { describe, expect, it } from 'vitest'
import {
  dispatchModeAddDays,
  dispatchModeAddMonths,
  dispatchModeAgendaHeading,
  dispatchModeMonthGrid,
  dispatchModeTwoWeekGrid,
  dispatchModeMonthTitle,
  sortDispatchModeAgendaBlocks,
  type DispatchModeAgendaBlock,
} from './dispatchModeSchedule'

describe('dispatchMode date math', () => {
  it('adds days across month/year boundaries', () => {
    expect(dispatchModeAddDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(dispatchModeAddDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('adds months clamped to the 1st', () => {
    expect(dispatchModeAddMonths('2026-07-21', 1)).toBe('2026-08-01')
    expect(dispatchModeAddMonths('2026-01-15', -1)).toBe('2025-12-01')
  })

  it('month title', () => {
    expect(dispatchModeMonthTitle('2026-07-21')).toBe('July 2026')
  })
})

describe('dispatchModeMonthGrid', () => {
  it('July 2026: Sunday-first weeks, padded with adjacent months', () => {
    const weeks = dispatchModeMonthGrid('2026-07-21')
    // July 1 2026 is a Wednesday → first week starts Sun Jun 28.
    expect(weeks[0]?.[0]).toEqual({ ymd: '2026-06-28', dayNum: 28, inMonth: false })
    expect(weeks[0]?.[3]).toEqual({ ymd: '2026-07-01', dayNum: 1, inMonth: true })
    const flat = weeks.flat()
    expect(flat.filter((d) => d.inMonth)).toHaveLength(31)
    for (const w of weeks) expect(w).toHaveLength(7)
  })

  it('February of a non-leap year starting on Sunday fits exactly 4 weeks', () => {
    // Feb 2026 starts Sunday, 28 days → exactly 4 rows.
    const weeks = dispatchModeMonthGrid('2026-02-10')
    expect(weeks).toHaveLength(4)
    expect(weeks[0]?.[0]).toEqual({ ymd: '2026-02-01', dayNum: 1, inMonth: true })
    expect(weeks[3]?.[6]).toEqual({ ymd: '2026-02-28', dayNum: 28, inMonth: true })
  })
})

describe('dispatchModeAgendaHeading', () => {
  it('prefixes Today only for today', () => {
    expect(dispatchModeAgendaHeading('2026-07-21', '2026-07-21')).toBe('Today · Tue, Jul 21')
    expect(dispatchModeAgendaHeading('2026-07-22', '2026-07-21')).toBe('Wed, Jul 22')
  })
})

describe('sortDispatchModeAgendaBlocks', () => {
  const B = (timeStart: string, assigneeName: string, jobName: string): DispatchModeAgendaBlock => ({
    id: `${timeStart}-${assigneeName}-${jobName}`,
    assigneeUserId: 'u',
    assigneeName,
    timeStart,
    timeEnd: '17:00',
    jobId: 'j',
    hcpNumber: null,
    clickNumber: null,
    jobName,
    jobAddress: '',
    customerName: '',
    serviceTypeName: null,
  })

  it('orders by time, then assignee, then job', () => {
    const sorted = sortDispatchModeAgendaBlocks([
      B('09:00', 'Zed', 'A job'),
      B('08:00', 'Amy', 'B job'),
      B('09:00', 'Amy', 'Z job'),
      B('09:00', 'Amy', 'A job'),
    ])
    expect(sorted.map((b) => b.id)).toEqual([
      '08:00-Amy-B job',
      '09:00-Amy-A job',
      '09:00-Amy-Z job',
      '09:00-Zed-A job',
    ])
  })
})

describe('dispatchModeTwoWeekGrid', () => {
  it('week containing today plus the next, Sunday-first', () => {
    const weeks = dispatchModeTwoWeekGrid('2026-07-21') // a Tuesday
    expect(weeks).toHaveLength(2)
    expect(weeks[0]?.[0]?.ymd).toBe('2026-07-19') // Sunday
    expect(weeks[0]?.[2]?.ymd).toBe('2026-07-21')
    expect(weeks[1]?.[0]?.ymd).toBe('2026-07-26')
    expect(weeks[1]?.[6]?.ymd).toBe('2026-08-01') // crosses the month boundary
    for (const w of weeks) expect(w).toHaveLength(7)
  })
})
