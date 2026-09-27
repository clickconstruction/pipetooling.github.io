import { describe, expect, it } from 'vitest'
import { approvalsPhonePeople, hoursPhoneClock, leftTodayRows, whosInRows, type HoursPhoneSession } from './hoursPhone'

const NOW = Date.parse('2026-09-27T16:14:00Z')
const s = (over: Partial<HoursPhoneSession>): HoursPhoneSession => ({ id: Math.random().toString(36), user_id: 'u', name: 'X', clocked_in_at: '2026-09-27T11:02:00Z', clocked_out_at: null, work_date: '2026-09-27', label: null, ...over })

describe('hoursPhoneClock', () => {
  it('reads as hours and minutes', () => {
    expect(hoursPhoneClock(5.2)).toBe('5:12')
    expect(hoursPhoneClock(0)).toBe('0:00')
    expect(hoursPhoneClock(0.999)).toBe('1:00')
    expect(hoursPhoneClock(-1)).toBe('0:00')
  })
})

describe('whosInRows', () => {
  it('lists each person in once, A–Z, with the session so far and the job in words', () => {
    const rows = whosInRows(
      [
        s({ user_id: 'm', name: 'Malachi', clocked_in_at: '2026-09-27T11:02:00Z', label: 'J1039 · Echols' }),
        s({ user_id: 'k', name: 'Kyle', clocked_in_at: '2026-09-27T12:58:00Z' }),
        s({ user_id: 'k', name: 'Kyle', clocked_in_at: '2026-09-27T14:00:00Z', label: 'J892' }),
        s({ user_id: 'g', name: 'grace', clocked_out_at: '2026-09-27T15:00:00Z' }),
      ],
      NOW,
    )
    expect(rows.map((r) => `${r.name}|${r.elapsed}|${r.label ?? '—'}`)).toEqual(['Kyle|3:16|—', 'Malachi|5:12|J1039 · Echols'])
  })
})

describe('leftTodayRows', () => {
  it('sums a person’s closed sessions, first in to last out, and leaves off anyone in now', () => {
    const closed = [
      s({ user_id: 'sam', name: 'Sam', clocked_in_at: '2026-09-27T11:00:00Z', clocked_out_at: '2026-09-27T13:00:00Z', label: 'J1038' }),
      s({ user_id: 'sam', name: 'Sam', clocked_in_at: '2026-09-27T13:30:00Z', clocked_out_at: '2026-09-27T16:00:00Z', label: 'J1038' }),
      s({ user_id: 'm', name: 'Malachi', clocked_in_at: '2026-09-27T09:00:00Z', clocked_out_at: '2026-09-27T10:00:00Z' }),
    ]
    expect(leftTodayRows(closed, new Set(['m']))).toEqual([{ userId: 'sam', name: 'Sam', firstInIso: '2026-09-27T11:00:00Z', lastOutIso: '2026-09-27T16:00:00Z', labels: ['J1038'], total: '4:30' }])
  })
})

describe('approvalsPhonePeople', () => {
  it('is one row per person, the longest-waiting first, with days, hours and the sessions naming no job', () => {
    const pending = [
      s({ user_id: 'k', name: 'Kyle', work_date: '2026-09-22', clocked_in_at: '2026-09-22T12:00:00Z', clocked_out_at: '2026-09-22T22:05:00Z', label: 'J892' }),
      s({ user_id: 'k', name: 'Kyle', work_date: '2026-09-21', clocked_in_at: '2026-09-21T12:00:00Z', clocked_out_at: '2026-09-21T18:00:00Z', label: 'J892' }),
      s({ user_id: 'k', name: 'Kyle', work_date: '2026-09-21', clocked_in_at: '2026-09-21T18:30:00Z', clocked_out_at: '2026-09-21T22:00:00Z' }),
      s({ user_id: 'a', name: 'Avery', work_date: '2026-09-18', clocked_in_at: '2026-09-18T12:00:00Z', clocked_out_at: '2026-09-18T20:00:00Z', label: 'J1' }),
      s({ user_id: 'z', name: 'Zed', work_date: '2026-09-25', clocked_in_at: '2026-09-25T12:00:00Z', clocked_out_at: null }),
    ]
    expect(approvalsPhonePeople(pending)).toEqual([
      { userId: 'a', name: 'Avery', sessions: 1, days: 1, hours: 8, oldestYmd: '2026-09-18', noJob: 0 },
      { userId: 'k', name: 'Kyle', sessions: 3, days: 2, hours: 19.6, oldestYmd: '2026-09-21', noJob: 1 },
    ])
  })
})
