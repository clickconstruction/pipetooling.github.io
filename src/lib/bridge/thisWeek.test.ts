import { describe, expect, it } from 'vitest'
import { buildThisWeek, type ThisWeekInput } from './thisWeek'

const base: ThisWeekInput = {
  unbilledUsd: 0,
  unbilledCount: 0,
  lateReceipts: { count: 0, usd: 0 },
  pendingClosedHours: 0,
  pendingClosedSessions: 0,
  payrollWeeklyEstUsd: 7448,
  noContractJobs: [],
  assumedHalfJobs: 0,
  assumedHalfEarnedUsd: 0,
  fieldEarnedPerHour: null,
  contributionMargin: null,
  overheadPerDayUsd: 0,
  bidsDue: [],
  dayLabel: (ymd) => ymd,
}

describe('buildThisWeek', () => {
  it('is empty with nothing to move', () => {
    expect(buildThisWeek(base)).toEqual([])
  })

  it('lists the moves in order, each sized and with its door', () => {
    const moves = buildThisWeek({
      ...base,
      unbilledUsd: 228_000,
      unbilledCount: 14,
      lateReceipts: { count: 48, usd: 227_536 },
      pendingClosedHours: 585,
      pendingClosedSessions: 104,
      noContractJobs: [{ id: 'a', label: '912' }, { id: 'b', label: '1067' }, { id: 'c', label: '1044' }, { id: 'd', label: '1047' }],
      assumedHalfJobs: 6,
      assumedHalfEarnedUsd: 20_341,
      fieldEarnedPerHour: 169,
      contributionMargin: 0.27,
      overheadPerDayUsd: 348,
      bidsDue: [{ id: 'x', label: 'B482 Clinic', bidValueUsd: 60_000, dueYmd: '2026-10-15' }],
    })
    expect(moves.map((m) => m.key)).toEqual(['bill', 'chase', 'approve', 'price', 'pct', 'field_day', 'overhead', 'bid'])
    expect(moves[0]).toMatchObject({ title: 'Bill the finished work', why: '$228k finished and not yet billed on 14 jobs; the biggest lever on both lines', lever: '+$228k owed to you', door: { to: '/jobs?tab=stages' } })
    expect(moves[1]).toMatchObject({ title: 'Chase the 48 late invoices', lever: '$228k', door: { to: '/jobs?tab=billing' } })
    expect(moves[2]).toMatchObject({ title: 'Approve the 585h pending', why: '104 sessions; the top line and payroll ($7,448/week) read low until then', lever: 'accuracy' })
    expect(moves[3]).toMatchObject({ title: 'Price jobs 912, 1067, 1044 and 1 more', lever: '4 jobs' })
    expect(moves[4]).toMatchObject({ title: 'Set % complete on 6 jobs', lever: '≈ $20.3k' })
    expect(moves[5]).toMatchObject({ title: 'One more field day a week', lever: '+$52/day', door: null })
    expect(moves[6]).toMatchObject({ title: 'Cut overhead 10%', lever: '+$35/day', door: { to: '/people?tab=overhead' } })
    expect(moves[7]).toMatchObject({ title: 'Win B482 Clinic', why: '$60,000 · due 2026-10-15', lever: '+$270/day over 60d' })
  })

  it('a bid with no margin known reads a dash', () => {
    const [m] = buildThisWeek({ ...base, bidsDue: [{ id: 'x', label: 'B1', bidValueUsd: 1000, dueYmd: '2026-10-15' }] })
    expect(m?.lever).toBe('—')
  })
})
