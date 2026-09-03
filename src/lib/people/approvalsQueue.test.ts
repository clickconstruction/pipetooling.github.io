import { describe, expect, it } from 'vitest'
import {
  buildApprovalsQueue,
  daysBetweenYmd,
  describeApproveOutcome,
  formatFlagCounts,
  formatWeekRangeLabel,
  sessionFlags,
  weekEndYmd,
  weekStartYmd,
  withoutSessionIds,
  type ApprovalsQueueSessionInput,
} from './approvalsQueue'

let seq = 0
function punch(
  user: string,
  workDate: string,
  hours: number,
  extra: Partial<ApprovalsQueueSessionInput> = {},
): ApprovalsQueueSessionInput {
  seq += 1
  const inMs = Date.UTC(2026, 0, 1, 14) // any instant; only the delta matters
  return {
    id: `s${seq}`,
    user_id: `u-${user}`,
    clocked_in_at: new Date(inMs).toISOString(),
    clocked_out_at: new Date(inMs + hours * 3_600_000).toISOString(),
    work_date: workDate,
    job_ledger_id: 'job-1',
    bid_id: null,
    users: { name: user },
    ...extra,
  }
}

describe('calendar helpers', () => {
  it('starts weeks on Sunday with pure YMD math', () => {
    expect(weekStartYmd('2026-08-17')).toBe('2026-08-16') // Monday → Sunday
    expect(weekStartYmd('2026-08-16')).toBe('2026-08-16') // Sunday stays
    expect(weekStartYmd('2026-09-05')).toBe('2026-08-30') // Saturday
    expect(weekEndYmd('2026-08-30')).toBe('2026-09-05')
  })

  it('labels a week inside one month or across two', () => {
    expect(formatWeekRangeLabel('2026-08-16', '2026-08-22')).toBe('Aug 16–22')
    expect(formatWeekRangeLabel('2026-08-30', '2026-09-05')).toBe('Aug 30 – Sep 5')
  })

  it('counts whole days between YMDs', () => {
    expect(daysBetweenYmd('2026-05-04', '2026-09-03')).toBe(122)
    expect(daysBetweenYmd('2026-09-03', '2026-09-03')).toBe(0)
  })
})

describe('sessionFlags', () => {
  it('flags long days, near-zero punches, and sessions with no job or bid', () => {
    expect(sessionFlags({ hours: 12.3, job_ledger_id: 'j', bid_id: null })).toEqual({ long: true, tiny: false, noJob: false })
    expect(sessionFlags({ hours: 0.01, job_ledger_id: 'j', bid_id: null })).toEqual({ long: false, tiny: true, noJob: false })
    expect(sessionFlags({ hours: 0, job_ledger_id: null, bid_id: null })).toEqual({ long: false, tiny: true, noJob: true })
    expect(sessionFlags({ hours: 8, job_ledger_id: null, bid_id: 'b' })).toEqual({ long: false, tiny: false, noJob: false })
    expect(sessionFlags({ hours: 12, job_ledger_id: 'j', bid_id: null }).long).toBe(false) // exactly 12 is not "longer than"
    expect(sessionFlags({ hours: 4 / 60, job_ledger_id: 'j', bid_id: null }).tiny).toBe(false) // a 4-minute focus switch is real
    expect(sessionFlags({ hours: 0.5 / 60, job_ledger_id: 'j', bid_id: null }).tiny).toBe(true) // 30 seconds is a double-tap
  })
})

describe('buildApprovalsQueue', () => {
  it('groups person → week → session, rolls up hours and flags, and orders oldest stall first', () => {
    const rows = [
      punch('Isiah', '2026-08-26', 11.98),
      punch('Isiah', '2026-08-17', 9.21),
      punch('Isiah', '2026-08-25', 0.01),
      punch('Isiah', '2026-08-31', 8),
      punch('Mario', '2026-05-04', 9),
      punch('Wendi', '2026-08-28', 7.82, { job_ledger_id: null }),
      punch('Wendi', '2026-08-25', 12.5),
      punch('Open', '2026-09-03', 3, { clocked_out_at: null }),
    ]
    const q = buildApprovalsQueue(rows, { todayYmd: '2026-09-03' })

    expect(q.count).toBe(7)
    expect(q.peopleCount).toBe(3)
    expect(q.weeksCount).toBe(5)
    expect(q.hours).toBe(58.52)
    expect(q.oldestWorkDate).toBe('2026-05-04')
    expect(q.oldestAgeDays).toBe(122)
    expect(q.flagCounts).toEqual({ long: 1, tiny: 1, noJob: 1 })
    expect(q.sessionIds).toHaveLength(7)

    expect(q.people.map((p) => p.name)).toEqual(['Mario', 'Isiah', 'Wendi'])

    const isiah = q.people[1]!
    expect(isiah.weeks.map((w) => w.label)).toEqual(['Aug 16–22', 'Aug 23–29', 'Aug 30 – Sep 5'])
    expect(isiah.count).toBe(4)
    expect(isiah.hours).toBe(29.2)
    expect(isiah.oldestWorkDate).toBe('2026-08-17')
    expect(isiah.oldestAgeDays).toBe(17)
    expect(isiah.flagCounts).toEqual({ long: 0, tiny: 1, noJob: 0 })

    const aug23 = isiah.weeks[1]!
    expect(aug23.sessions.map((s) => s.workDate)).toEqual(['2026-08-25', '2026-08-26'])
    expect(aug23.hours).toBe(11.99)
    expect(aug23.sessions[0]!.flags.tiny).toBe(true)
    expect(aug23.sessions[0]!.flagged).toBe(true)
    expect(aug23.sessions[1]!.flags.long).toBe(false)

    const wendi = q.people[2]!
    expect(wendi.flagCounts).toEqual({ long: 1, tiny: 0, noJob: 1 })
    expect(wendi.sessionIds).toHaveLength(2)
  })

  it('breaks an oldest-day tie by hours descending', () => {
    const rows = [punch('Small', '2026-08-24', 2), punch('Big', '2026-08-24', 9)]
    const q = buildApprovalsQueue(rows, { todayYmd: '2026-09-03' })
    expect(q.people.map((p) => p.name)).toEqual(['Big', 'Small'])
  })

  it('is empty for no closed rows', () => {
    const q = buildApprovalsQueue([punch('Open', '2026-09-03', 3, { clocked_out_at: null })], { todayYmd: '2026-09-03' })
    expect(q.count).toBe(0)
    expect(q.people).toEqual([])
    expect(q.oldestWorkDate).toBeNull()
    expect(q.oldestAgeDays).toBe(0)
  })

  it('names an unnamed user and keys people by user id, not name', () => {
    const rows = [
      punch('A', '2026-08-24', 1, { user_id: 'x', users: { name: '  ' } }),
      punch('A', '2026-08-25', 1, { user_id: 'y', users: null }),
    ]
    const q = buildApprovalsQueue(rows, { todayYmd: '2026-09-03' })
    expect(q.people.map((p) => [p.userId, p.name])).toEqual([
      ['x', 'Unknown'],
      ['y', 'Unknown'],
    ])
  })
})

describe('formatFlagCounts', () => {
  it('lists only the non-zero parts', () => {
    expect(formatFlagCounts({ long: 3, tiny: 2, noJob: 1 })).toBe('3 long days · 2 near-zero · 1 no job')
    expect(formatFlagCounts({ long: 1, tiny: 0, noJob: 0 })).toBe('1 long day')
    expect(formatFlagCounts({ long: 0, tiny: 0, noJob: 0 })).toBe('')
  })
})

describe('withoutSessionIds / describeApproveOutcome', () => {
  it('drops the given ids and leaves the rest in order', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(withoutSessionIds(rows, ['b']).map((r) => r.id)).toEqual(['a', 'c'])
    expect(withoutSessionIds(rows, []).map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('says when the RPC skipped zero-length sessions', () => {
    expect(describeApproveOutcome(3, 3)).toEqual({ message: 'Approved 3 sessions — added to payroll', variant: 'success' })
    expect(describeApproveOutcome(1, 1).message).toBe('Approved 1 session — added to payroll')
    expect(describeApproveOutcome(4, 3)).toEqual({
      message: 'Approved 3 of 4 — 1 zero-length session was skipped. Reject or fix it.',
      variant: 'warning',
    })
    expect(describeApproveOutcome(5, 3).message).toBe('Approved 3 of 5 — 2 zero-length sessions were skipped. Reject or fix them.')
  })
})
