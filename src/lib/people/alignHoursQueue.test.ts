import { describe, expect, it } from 'vitest'
import {
  alignQueueUserIdsByDay,
  buildAlignHoursQueue,
  formatAlignDurationHours,
  isAlignHoursCandidate,
  recentAssignedPicksForUser,
  type AlignHoursSession,
} from './alignHoursQueue'

function session(
  overrides: Partial<AlignHoursSession> = {},
): AlignHoursSession {
  return {
    id: 'id-1',
    user_id: 'u-1',
    clocked_in_at: '2026-07-28T12:00:00.000Z',
    clocked_out_at: '2026-07-28T20:30:00.000Z',
    work_date: '2026-07-28',
    notes: 'finishing top out',
    origin: 'user_punch',
    job_ledger_id: null,
    bid_id: null,
    approved_at: null,
    rejected_at: null,
    revoked_at: null,
    users: { name: 'Marcus T' },
    jobs_ledger: null,
    bids: null,
    ...overrides,
  }
}

describe('isAlignHoursCandidate', () => {
  it('accepts a closed, unassigned, countable session', () => {
    expect(isAlignHoursCandidate(session())).toBe(true)
  })

  it('rejects sessions already linked to a job or bid', () => {
    expect(isAlignHoursCandidate(session({ job_ledger_id: 'j-1' }))).toBe(false)
    expect(isAlignHoursCandidate(session({ bid_id: 'b-1' }))).toBe(false)
  })

  it('rejects open sessions', () => {
    expect(isAlignHoursCandidate(session({ clocked_out_at: null }))).toBe(false)
  })

  it('rejects rejected and revoked sessions', () => {
    expect(
      isAlignHoursCandidate(
        session({ rejected_at: '2026-07-28T21:00:00.000Z' }),
      ),
    ).toBe(false)
    expect(
      isAlignHoursCandidate(
        session({ revoked_at: '2026-07-28T21:00:00.000Z' }),
      ),
    ).toBe(false)
  })

  it('keeps approved sessions in the queue', () => {
    expect(
      isAlignHoursCandidate(
        session({ approved_at: '2026-07-28T21:00:00.000Z' }),
      ),
    ).toBe(true)
  })

  it('keeps salary_schedule sessions in the queue', () => {
    expect(isAlignHoursCandidate(session({ origin: 'salary_schedule' }))).toBe(
      true,
    )
  })

  it('rejects local People-Hours draft rows (no DB row yet)', () => {
    expect(
      isAlignHoursCandidate(
        session({ id: 'draft:people-hours:u-1:2026-07-28' }),
      ),
    ).toBe(false)
  })
})

describe('buildAlignHoursQueue', () => {
  it('filters non-candidates and groups by day ascending', () => {
    const q = buildAlignHoursQueue([
      session({
        id: 'b',
        work_date: '2026-07-29',
        clocked_in_at: '2026-07-29T12:00:00.000Z',
      }),
      session({ id: 'a' }),
      session({ id: 'assigned', job_ledger_id: 'j-1' }),
      session({ id: 'open', clocked_out_at: null }),
    ])
    expect(q.days.map((d) => d.workDate)).toEqual(['2026-07-28', '2026-07-29'])
    expect(q.totalSessions).toBe(2)
  })

  it('dedupes by session id', () => {
    const q = buildAlignHoursQueue([
      session({ id: 'dup' }),
      session({ id: 'dup' }),
    ])
    expect(q.totalSessions).toBe(1)
  })

  it('sorts rows by person name then clock-in time', () => {
    const q = buildAlignHoursQueue([
      session({
        id: '1',
        users: { name: 'zed' },
        clocked_in_at: '2026-07-28T12:00:00.000Z',
      }),
      session({
        id: '2',
        users: { name: 'Amy' },
        clocked_in_at: '2026-07-28T14:00:00.000Z',
      }),
      session({
        id: '3',
        users: { name: 'Amy' },
        clocked_in_at: '2026-07-28T11:00:00.000Z',
      }),
    ])
    expect(q.days[0]?.rows.map((r) => r.session.id)).toEqual(['3', '2', '1'])
  })

  it('computes duration hours and falls back to — for a missing name', () => {
    const q = buildAlignHoursQueue([session({ users: null })])
    const row = q.days[0]?.rows[0]
    expect(row?.personName).toBe('—')
    expect(row?.durationHours).toBeCloseTo(8.5)
  })
})

describe('alignQueueUserIdsByDay', () => {
  it('returns distinct user ids per day', () => {
    const q = buildAlignHoursQueue([
      session({ id: '1', user_id: 'u-1' }),
      session({
        id: '2',
        user_id: 'u-1',
        clocked_in_at: '2026-07-28T21:00:00.000Z',
        clocked_out_at: '2026-07-28T22:00:00.000Z',
      }),
      session({ id: '3', user_id: 'u-2' }),
    ])
    expect(alignQueueUserIdsByDay(q)).toEqual([
      { workDate: '2026-07-28', userIds: ['u-1', 'u-2'] },
    ])
  })
})

describe('recentAssignedPicksForUser', () => {
  const jobEmbed = {
    hcp_number: '1842',
    job_name: 'Riverside Dr',
    job_address: '',
    service_type_id: null,
    click_number: null,
  }

  it('returns distinct recent jobs/bids for the user, newest first, capped', () => {
    const picks = recentAssignedPicksForUser(
      [
        session({
          id: '1',
          job_ledger_id: 'j-1',
          jobs_ledger: jobEmbed,
          clocked_in_at: '2026-07-27T12:00:00.000Z',
        }),
        session({
          id: '2',
          job_ledger_id: 'j-1',
          jobs_ledger: jobEmbed,
          clocked_in_at: '2026-07-28T12:00:00.000Z',
        }),
        session({
          id: '3',
          bid_id: 'b-1',
          clocked_in_at: '2026-07-29T12:00:00.000Z',
        }),
        session({ id: 'other-user', user_id: 'u-2', job_ledger_id: 'j-9' }),
        session({ id: 'unassigned' }),
      ],
      'u-1',
    )
    expect(picks.map((p) => `${p.source}:${p.id}`)).toEqual([
      'bid:b-1',
      'job:j-1',
    ])
    expect(picks[1]?.embeds.jobs_ledger?.hcp_number).toBe('1842')
  })

  it('caps at max', () => {
    const picks = recentAssignedPicksForUser(
      [
        session({ id: '1', job_ledger_id: 'j-1' }),
        session({ id: '2', job_ledger_id: 'j-2' }),
        session({ id: '3', job_ledger_id: 'j-3' }),
      ],
      'u-1',
      2,
    )
    expect(picks).toHaveLength(2)
  })
})

describe('formatAlignDurationHours', () => {
  it('renders one decimal', () => {
    expect(formatAlignDurationHours(8.5)).toBe('8.5 h')
    expect(formatAlignDurationHours(8.04)).toBe('8.0 h')
    expect(formatAlignDurationHours(0)).toBe('0.0 h')
  })
})
