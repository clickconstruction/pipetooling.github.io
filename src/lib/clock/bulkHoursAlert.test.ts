import { describe, expect, it } from 'vitest'
import {
  bulkHoursAlertDetail,
  bulkHoursAlertTitle,
  bulkHoursAlertsSummary,
  bulkHoursBurstMinutes,
  parseBulkHoursAlertRow,
  type BulkHoursAlert,
} from './bulkHoursAlert'

const row = {
  actor_id: 'u-taunya',
  actor_name: 'Taunya',
  days: 8,
  people: 2,
  seconds: 257_400,
  waiting_days: 6,
  first_typed_at: '2026-09-30T15:00:00.000Z',
  last_typed_at: '2026-09-30T15:25:10.000Z',
  window_start: '2026-09-30T15:00:00.000Z',
  window_end: '2026-09-30T16:00:00.000Z',
  people_names: ['Darren', 'Michael A'],
  first_work_date: '2026-09-21',
  last_work_date: '2026-09-25',
}

function alert(over: Partial<BulkHoursAlert> = {}): BulkHoursAlert {
  return { ...(parseBulkHoursAlertRow(row) as BulkHoursAlert), ...over }
}

describe('parseBulkHoursAlertRow', () => {
  it('reads the RPC row, numbers as numbers', () => {
    const a = parseBulkHoursAlertRow({ ...row, days: '8', seconds: '257400' })
    expect(a?.days).toBe(8)
    expect(a?.seconds).toBe(257_400)
    expect(a?.peopleNames).toEqual(['Darren', 'Michael A'])
  })
  it('drops a row with no typist', () => {
    expect(parseBulkHoursAlertRow({ ...row, actor_id: null })).toBeNull()
    expect(parseBulkHoursAlertRow(null)).toBeNull()
  })
})

describe('bulkHoursBurstMinutes', () => {
  it('rounds first-to-last to whole minutes, never below one', () => {
    expect(bulkHoursBurstMinutes(alert())).toBe(25)
    expect(bulkHoursBurstMinutes(alert({ lastTypedAt: row.first_typed_at }))).toBe(1)
  })
})

describe('bulkHoursAlertTitle', () => {
  it('names the typist, the days and the minutes', () => {
    expect(bulkHoursAlertTitle(alert())).toBe('Taunya typed hours onto 8 days in 25 minutes')
  })
  it('names the one person when it is one person', () => {
    expect(bulkHoursAlertTitle(alert({ people: 1, peopleNames: ['Michael A'], days: 3, lastTypedAt: '2026-09-30T15:04:00.000Z' }))).toBe(
      'Taunya typed hours onto 3 days for Michael A in 4 minutes',
    )
  })
})

describe('bulkHoursAlertDetail', () => {
  it('lists the people, the span, the hours and what still waits', () => {
    expect(bulkHoursAlertDetail(alert())).toBe('Darren, Michael A · Sep 21–25 · 71.5 h the clock did not record, 6 days still waiting, 2 already looked at.')
  })
  it('one person, one day, all looked at', () => {
    expect(bulkHoursAlertDetail(alert({ people: 1, peopleNames: ['Michael A'], days: 2, waitingDays: 0, firstWorkDate: '2026-09-25', lastWorkDate: '2026-09-25', seconds: 39_600 }))).toBe(
      'Sep 25 · 11.0 h the clock did not record, every day already looked at by someone else.',
    )
  })
  it('a span across months keeps both months', () => {
    expect(bulkHoursAlertDetail(alert({ firstWorkDate: '2026-09-28', lastWorkDate: '2026-10-02' }))).toContain('Sep 28–Oct 2')
  })
})

describe('bulkHoursAlertsSummary', () => {
  it('sums the days and names the newest', () => {
    expect(bulkHoursAlertsSummary([alert(), alert({ actorId: 'u-wendi', actorName: 'Wendi', days: 2 })])).toBe(
      '10 days across 2 bursts by 2 people — newest: Taunya typed hours onto 8 days in 25 minutes.',
    )
  })
})
