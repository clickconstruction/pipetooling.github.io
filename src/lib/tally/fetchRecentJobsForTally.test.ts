import { describe, expect, it } from 'vitest'
import { marksFromPurchases, marksFromSessions } from './fetchRecentJobsForTally'

describe('marksFromSessions', () => {
  it('one clock-in is one mark on its day; a session with no job is skipped', () => {
    expect(
      marksFromSessions([
        { work_date: '2026-10-29', job_ledger_id: 'a', clocked_in_at: '2026-10-29T12:48:00Z' },
        { work_date: '2026-10-28', job_ledger_id: null, clocked_in_at: '2026-10-28T12:00:00Z' },
      ]),
    ).toEqual([{ jobId: 'a', ymd: '2026-10-29', at: '2026-10-29T12:48:00Z', source: 'clock' }])
  })
})

describe('marksFromPurchases', () => {
  it('every job a purchase was sorted to is a mark on the swipe day; an unsorted purchase is none', () => {
    expect(
      marksFromPurchases([
        { job_splits: [{ job_id: 'a', hcp_number: '972', job_name: 'x' }, { job_id: 'b' }], raw: { createdAt: '2026-10-24T22:10:00Z' }, posted_at: '2026-10-26T06:00:00Z' },
        { job_splits: [], raw: null, posted_at: '2026-10-25T06:00:00Z' },
        { job_splits: null, raw: null, posted_at: '2026-10-25T06:00:00Z' },
      ]),
    ).toEqual([
      { jobId: 'a', ymd: '2026-10-24', at: '2026-10-26T06:00:00Z', source: 'purchase' },
      { jobId: 'b', ymd: '2026-10-24', at: '2026-10-26T06:00:00Z', source: 'purchase' },
    ])
  })
  it('falls back to the posted day when the swipe time is not in the raw row', () => {
    expect(marksFromPurchases([{ job_splits: [{ job_id: 'a' }], raw: {}, posted_at: '2026-10-26T06:00:00Z' }])[0]!.ymd).toBe('2026-10-26')
  })
})
