import { describe, expect, it } from 'vitest'
import { orderSortModeDayJobIds } from './sortModeDayJobsOrder'

const DAYS = { beforeYmd: '2026-09-14', anchorYmd: '2026-09-15', afterYmd: '2026-09-16' }

describe('orderSortModeDayJobIds', () => {
  it('leads with the swipe day’s clocked job even when the day before comes first in the rows', () => {
    expect(
      orderSortModeDayJobIds({
        ...DAYS,
        sessions: [
          { work_date: '2026-09-14', job_ledger_id: 'job-before' },
          { work_date: '2026-09-16', job_ledger_id: 'job-after' },
          { work_date: '2026-09-15', job_ledger_id: 'job-day' },
        ],
        scheduledByDay: new Map(),
      }),
    ).toEqual(['job-day', 'job-before', 'job-after'])
  })

  it('puts the swipe day’s schedule ahead of the shoulders’ clocks', () => {
    expect(
      orderSortModeDayJobIds({
        ...DAYS,
        sessions: [{ work_date: '2026-09-14', job_ledger_id: 'job-before' }],
        scheduledByDay: new Map([
          ['2026-09-15', ['job-scheduled']],
          ['2026-09-16', ['job-later']],
        ]),
      }),
    ).toEqual(['job-scheduled', 'job-before', 'job-later'])
  })

  it('offers each job once, at its first place, and skips time with no job', () => {
    expect(
      orderSortModeDayJobIds({
        ...DAYS,
        sessions: [
          { work_date: '2026-09-15', job_ledger_id: null },
          { work_date: '2026-09-15', job_ledger_id: 'job-a' },
          { work_date: '2026-09-14', job_ledger_id: 'job-a' },
        ],
        scheduledByDay: new Map([['2026-09-15', ['job-a', 'job-b']]]),
      }),
    ).toEqual(['job-a', 'job-b'])
  })
})
