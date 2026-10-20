import { describe, expect, it } from 'vitest'
import { fieldPaceByHours } from './fieldPace'
import type { VectorSession } from './vectors'

const s = (workDate: string, hours: number, jobId: string | null, extra: Partial<VectorSession> = {}): VectorSession => ({ userId: 'u1', workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false, ...extra })
const rates = new Map([
  ['j1', 100],
  ['j2', 50],
])
const window = { windowStart: '2026-08-16', todayYmd: '2026-10-11', weeks: 8 }

describe('fieldPaceByHours', () => {
  it('reads earned per week on recorded time, pending hours included', () => {
    const pace = fieldPaceByHours({
      ...window,
      ratePerHourByJob: rates,
      sessions: [
        s('2026-09-01', 8, 'j1'), // $800 approved
        s('2026-09-02', 8, 'j2', { approved: false, pending: true }), // $400 waiting
        s('2026-09-03', 4, 'j1', { approved: false, pending: false }), // rejected: not counted
        s('2026-09-04', 8, null, { onBid: true }), // bid time: not field
        s('2026-09-05', 8, 'j1', { officeJob: true }), // office: not field
        s('2026-08-01', 8, 'j1'), // before the window
      ],
    })!
    expect(pace.earnedPerWeekUsd).toBe(1200 / 8)
    expect(pace.approvedEarnedPerWeekUsd).toBe(800 / 8)
    expect(pace.hoursPerWeek).toBe(16 / 8)
    expect(pace.pendingHours).toBe(8)
  })
  it('reads a job with no rate as earning nothing, and no sessions as no pace', () => {
    expect(fieldPaceByHours({ ...window, ratePerHourByJob: rates, sessions: [s('2026-09-01', 8, 'j9')] })!.earnedPerWeekUsd).toBe(0)
    expect(fieldPaceByHours({ ...window, ratePerHourByJob: rates, sessions: [] })).toBeNull()
  })
})
