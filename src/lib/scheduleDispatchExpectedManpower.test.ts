import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

import type { JobScheduleBlockRow } from './jobScheduleBlocks'
import { scheduleFormatWindow } from './jobScheduleChicago'
import {
  HUB_EXPECTED_MANPOWER_ALL_WEEK,
  expectedManpowerBlockPersonHours,
  expectedManpowerJobGroupPayrollEstimate,
  expectedManpowerJobGroupsForDay,
  expectedManpowerPersonHoursTotalForDayKeys,
  expectedManpowerRowsForDay,
  expectedManpowerRowsForVisibleDays,
  expectedManpowerWeekPersonHoursTotal,
  formatExpectedManpowerPersonHours,
} from './scheduleDispatchExpectedManpower'

const block = (id: string, user: string, work_date: string, time_start: string, time_end: string, anchor: { job_id?: string; bid_id?: string } = { job_id: 'J1' }): JobScheduleBlockRow =>
  ({ id, assignee_user_id: user, work_date, time_start, time_end, job_id: anchor.job_id ?? null, bid_id: anchor.bid_id ?? null }) as unknown as JobScheduleBlockRow

const titles: Record<string, string> = { J1: 'Smith residence', J2: 'acme warehouse', 'bid:B1': 'Hyper Kidz bid' }
const names: Record<string, string> = { u1: 'Dana', u2: 'Marcus', u3: 'Paige' }
const title = (id: string) => titles[id] ?? id
const name = (id: string) => names[id] ?? id

describe('hours', () => {
  it('a block is its length in hours, never negative', () => {
    expect(expectedManpowerBlockPersonHours({ time_start: '08:00:00', time_end: '16:30:00' })).toBe(8.5)
    expect(expectedManpowerBlockPersonHours({ time_start: '16:00:00', time_end: '08:00:00' })).toBe(0)
  })
  it('week and day-key totals', () => {
    const blocks = [block('a', 'u1', '2026-09-01', '08:00', '12:00'), block('b', 'u2', '2026-09-01', '08:00', '16:00'), block('c', 'u1', '2026-09-02', '08:00', '10:00')]
    expect(expectedManpowerWeekPersonHoursTotal(blocks)).toBe(14)
    expect(expectedManpowerPersonHoursTotalForDayKeys(blocks, ['2026-09-01'])).toBe(12)
    expect(expectedManpowerPersonHoursTotalForDayKeys(blocks, [])).toBe(0)
  })
  it('formats hours to one decimal, dropping .0', () => {
    expect(formatExpectedManpowerPersonHours(0)).toBe('0')
    expect(formatExpectedManpowerPersonHours(8)).toBe('8')
    expect(formatExpectedManpowerPersonHours(7.5)).toBe('7.5')
    expect(formatExpectedManpowerPersonHours(7.26)).toBe('7.3')
    expect(formatExpectedManpowerPersonHours(Number.NaN)).toBe('0')
  })
  it('the all-week tab value is not a calendar key', () => {
    expect(/^\d{4}-\d{2}-\d{2}$/.test(HUB_EXPECTED_MANPOWER_ALL_WEEK)).toBe(false)
  })
})

describe('rows', () => {
  const blocks = [
    block('b1', 'u2', '2026-09-01', '13:00:00', '15:00:00', { job_id: 'J1' }),
    block('b2', 'u1', '2026-09-01', '08:00:00', '12:00:00', { job_id: 'J1' }),
    block('b3', 'u3', '2026-09-01', '08:00:00', '09:00:00', { job_id: 'J2' }),
    block('b4', 'u1', '2026-09-02', '08:00:00', '10:00:00', { bid_id: 'B1' }),
  ]

  it('expectedManpowerRowsForDay filters to the day, resolves titles (bid anchors included) and sorts by title, date, time', () => {
    const rows = expectedManpowerRowsForDay(blocks, '2026-09-01', title, name)
    expect(rows.map((r) => [r.blockId, r.jobTitle, r.personName, r.personHours])).toEqual([
      ['b3', 'acme warehouse', 'Paige', 1], // case-insensitive title sort: "acme" before "Smith"
      ['b2', 'Smith residence', 'Dana', 4],
      ['b1', 'Smith residence', 'Marcus', 2],
    ])
    expect(rows[0]!.windowLabel).toBe(scheduleFormatWindow('08:00:00', '09:00:00'))
    const bidRows = expectedManpowerRowsForDay(blocks, '2026-09-02', title, name)
    expect(bidRows).toHaveLength(1)
    expect(bidRows[0]).toMatchObject({ jobId: 'bid:B1', jobTitle: 'Hyper Kidz bid', assigneeUserId: 'u1', workDate: '2026-09-02' })
  })

  it('expectedManpowerRowsForVisibleDays spans several days and returns nothing for no days', () => {
    expect(expectedManpowerRowsForVisibleDays(blocks, ['2026-09-01', '2026-09-02'], title, name)).toHaveLength(4)
    expect(expectedManpowerRowsForVisibleDays(blocks, [], title, name)).toEqual([])
  })

  it('expectedManpowerJobGroupsForDay rolls up by job, biggest first, counting distinct people', () => {
    const groups = expectedManpowerJobGroupsForDay(expectedManpowerRowsForDay(blocks, '2026-09-01', title, name))
    expect(groups.map((g) => [g.jobId, g.totalPersonHours, g.distinctPeopleCount, g.rows.map((r) => r.blockId)])).toEqual([
      ['J1', 6, 2, ['b2', 'b1']],
      ['J2', 1, 1, ['b3']],
    ])
    const same = expectedManpowerJobGroupsForDay(expectedManpowerRowsForDay([blocks[1]!, blocks[1]!], '2026-09-01', title, name))
    expect(same[0]?.distinctPeopleCount).toBe(1)
  })

  it('expectedManpowerJobGroupPayrollEstimate multiplies hours by wage and skips unknown rates', () => {
    const rows = expectedManpowerRowsForDay(blocks, '2026-09-01', title, name)
    expect(expectedManpowerJobGroupPayrollEstimate(rows, (u) => ({ u1: 30, u2: 40 })[u] ?? Number.NaN)).toBe(4 * 30 + 2 * 40)
    expect(expectedManpowerJobGroupPayrollEstimate(rows, () => 0)).toBe(0)
  })
})
