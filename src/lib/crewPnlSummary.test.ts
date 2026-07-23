import { describe, expect, it } from 'vitest'
import {
  buildCrewPnlPersonResolver,
  crewPnlRangeForPreset,
  buildCrewPnlSummary,
  ymdInRange,
  type CrewPnlJobInput,
  type CrewPnlRosterPerson,
  type CrewPnlSubLaborInput,
  type CrewPnlTeamLaborInput,
} from './crewPnlSummary'

const ALL: { start: null; end: null } = { start: null, end: null }

const people: CrewPnlRosterPerson[] = [
  { id: 'per-mike', name: 'Mike Z', accountUserId: 'user-mike' },
  { id: 'per-paige', name: 'Paige', accountUserId: null },
]

function job(partial: Partial<CrewPnlJobInput>): CrewPnlJobInput {
  return {
    id: 'j1',
    jobLabel: '769',
    revenue: null,
    teamMembers: [],
    fallbackDate: null,
    ...partial,
  }
}

describe('ymdInRange', () => {
  it('treats null bounds as open and dateless values as all-time only', () => {
    expect(ymdInRange('2026-06-01', ALL)).toBe(true)
    expect(ymdInRange('2026-06-01', { start: '2026-06-01', end: '2026-06-30' })).toBe(true)
    expect(ymdInRange('2026-05-31', { start: '2026-06-01', end: null })).toBe(false)
    expect(ymdInRange('2026-07-01', { start: null, end: '2026-06-30' })).toBe(false)
    expect(ymdInRange(null, ALL)).toBe(true)
    expect(ymdInRange(null, { start: '2026-06-01', end: null })).toBe(false)
  })
})

describe('buildCrewPnlPersonResolver', () => {
  it('unifies account users, roster names, and free-text spellings onto one person', () => {
    const r = buildCrewPnlPersonResolver(people)
    const viaUser = r.keyForUser('user-mike', 'M. Zee')
    const viaName = r.keyForName('  mike z ')
    expect(viaUser).toBe('p:per-mike')
    expect(viaName).toBe('p:per-mike')
    expect(r.displayName(viaUser)).toBe('Mike Z')
    expect(r.isUnmatched(viaUser)).toBe(false)
  })
  it('keys unresolvable names on the normalized string and flags them', () => {
    const r = buildCrewPnlPersonResolver(people)
    const k = r.keyForName('Stray Person')
    expect(k).toBe('n:stray person')
    expect(r.displayName(k)).toBe('Stray Person')
    expect(r.isUnmatched(k)).toBe(true)
  })
})

describe('buildCrewPnlSummary', () => {
  const teamLabor: CrewPnlTeamLaborInput[] = [
    {
      jobId: 'j1',
      breakdown: [
        {
          personName: 'Mike Z',
          byWorkDate: [
            { workDate: '2026-06-01', hours: 6, cost: 180 },
            { workDate: '2026-06-02', hours: 2, cost: 60 },
          ],
        },
        { personName: 'Paige', byWorkDate: [{ workDate: '2026-06-01', hours: 2, cost: 50 }] },
      ],
    },
  ]

  it('weights billing by crew hours, not equal split', () => {
    const s = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 1000, teamMembers: [] })],
      teamLabor,
      subLabor: [],
      people,
      range: ALL,
    })
    const mike = s.rows.find((r) => r.key === 'p:per-mike')!
    const paige = s.rows.find((r) => r.key === 'p:per-paige')!
    expect(mike.billing).toBeCloseTo(800, 5) // 8h of 10h
    expect(paige.billing).toBeCloseTo(200, 5)
    expect(mike.profit).toBeCloseTo(800 - 240, 5)
    expect(mike.billingPerHour).toBeCloseTo(100, 5)
    expect(mike.hasEstimatedBilling).toBe(false)
  })

  it('a date window attributes the earned slice of revenue', () => {
    const s = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 1000 })],
      teamLabor,
      subLabor: [],
      people,
      range: { start: '2026-06-02', end: '2026-06-02' },
    })
    const mike = s.rows.find((r) => r.key === 'p:per-mike')!
    expect(mike.hours).toBeCloseTo(2, 5)
    expect(mike.billing).toBeCloseTo(200, 5) // 2h of the job's 10 all-time hours
    expect(s.rows.find((r) => r.key === 'p:per-paige')).toBeUndefined()
  })

  it('falls back to an equal split (marked estimated) when a revenue job has no crew hours', () => {
    const s = buildCrewPnlSummary({
      jobs: [
        job({
          id: 'j2',
          jobLabel: '800',
          revenue: 900,
          teamMembers: [
            { userId: 'user-mike', userName: 'Mike Z' },
            { userId: null, userName: 'Stray Person' },
            { userId: null, userName: 'Paige' },
          ],
          fallbackDate: '2026-06-10',
        }),
      ],
      teamLabor: [],
      subLabor: [],
      people,
      range: ALL,
    })
    const mike = s.rows.find((r) => r.key === 'p:per-mike')!
    expect(mike.billing).toBeCloseTo(300, 5)
    expect(mike.hasEstimatedBilling).toBe(true)
    expect(mike.perJob[0]?.kind).toBe('billing-fallback')
    const stray = s.rows.find((r) => r.key === 'n:stray person')!
    expect(stray.unmatched).toBe(true)
  })

  it('windows fallback jobs by their fallback date', () => {
    const s = buildCrewPnlSummary({
      jobs: [
        job({
          id: 'j2',
          revenue: 900,
          teamMembers: [{ userId: 'user-mike', userName: 'Mike Z' }],
          fallbackDate: '2026-01-05',
        }),
      ],
      teamLabor: [],
      subLabor: [],
      people,
      range: { start: '2026-06-01', end: null },
    })
    expect(s.rows).toHaveLength(0)
  })

  it('splits sub-sheet labor cost and hours across assigned names, merging by person', () => {
    const subLabor: CrewPnlSubLaborInput[] = [
      {
        id: 'lj1',
        jobLabel: 'sub 42',
        jobId: null,
      jobDate: '2026-06-03',
        assignedNames: ['mike z', 'Stray Person'],
        cost: 400,
        hours: 10,
      },
    ]
    const s = buildCrewPnlSummary({ jobs: [], teamLabor, subLabor, people, range: ALL })
    const mike = s.rows.find((r) => r.key === 'p:per-mike')!
    expect(mike.laborCost).toBeCloseTo(240 + 200, 5) // crew cost + sub share
    expect(mike.hours).toBeCloseTo(8 + 5, 5)
    expect(mike.perJob.some((l) => l.kind === 'sub')).toBe(true)
  })

  it('totals equal the sums of the visible rows', () => {
    const s = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 1000 })],
      teamLabor,
      subLabor: [],
      people,
      range: ALL,
    })
    expect(s.totals.billing).toBeCloseTo(s.rows.reduce((t, r) => t + r.billing, 0), 5)
    expect(s.totals.laborCost).toBeCloseTo(s.rows.reduce((t, r) => t + r.laborCost, 0), 5)
    expect(s.totals.profit).toBeCloseTo(s.totals.billing - s.totals.laborCost, 5)
  })

  it('sorts rows by profit descending', () => {
    const s = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 1000 })],
      teamLabor,
      subLabor: [],
      people,
      range: ALL,
    })
    expect(s.rows[0]?.key).toBe('p:per-mike')
  })
})

describe('crewPnlRangeForPreset', () => {
  it('builds ranges from a today YMD with pure string math', () => {
    expect(crewPnlRangeForPreset('2026-07-12', 'all')).toEqual({ start: null, end: null })
    expect(crewPnlRangeForPreset('2026-07-12', 'this_month')).toEqual({ start: '2026-07-01', end: '2026-07-12' })
    expect(crewPnlRangeForPreset('2026-07-12', 'last_month')).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    expect(crewPnlRangeForPreset('2026-01-15', 'last_month')).toEqual({ start: '2025-12-01', end: '2025-12-31' })
    expect(crewPnlRangeForPreset('2026-07-12', 'this_quarter')).toEqual({ start: '2026-07-01', end: '2026-07-12' })
    expect(crewPnlRangeForPreset('2026-05-02', 'this_quarter')).toEqual({ start: '2026-04-01', end: '2026-05-02' })
    expect(crewPnlRangeForPreset('2026-07-12', 'this_year')).toEqual({ start: '2026-01-01', end: '2026-07-12' })
  })
})

describe('sub labor revenue share via equivalent hours (v2.974)', () => {
  const sub = (partial: Partial<CrewPnlSubLaborInput>): CrewPnlSubLaborInput => ({
    id: 'sheet-1',
    jobId: null,
    jobLabel: 'Sub sheet 769',
    jobDate: '2026-06-10',
    assignedNames: ['Paige'],
    cost: 3000,
    hours: 0,
    ...partial,
  })
  const crewRow = (jobId: string, hours: number, cost: number): CrewPnlTeamLaborInput => ({
    jobId,
    breakdown: [{ personName: 'Mike Z', byWorkDate: [{ workDate: '2026-06-10', hours, cost }] }],
  })

  it('the worked example: 100 clocked hours and a $3,000 flat sheet at $30/hr split revenue 50/50', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 10_000 })],
      teamLabor: [crewRow('j1', 100, 3000)],
      subLabor: [sub({ jobId: 'j1' })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const mike = summary.rows.find((r) => r.displayName === 'Mike Z')
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(mike?.billing).toBeCloseTo(5000)
    expect(paige?.billing).toBeCloseTo(5000)
    expect(paige?.hours).toBeCloseTo(100) // imputed equivalent hours
    expect(paige?.hasEstimatedBilling).toBe(true) // ≈ affordance
    expect(mike?.hasEstimatedBilling).toBe(false)
  })

  it('a sub-only job gives its whole revenue to the sub', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 4_500 })],
      teamLabor: [],
      subLabor: [sub({ jobId: 'j1', cost: 1500 })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(paige?.billing).toBeCloseTo(4500)
    expect(paige?.laborCost).toBeCloseTo(1500)
    expect(paige?.profit).toBeCloseTo(3000)
  })

  it('real sheet hours win over imputation and are not flagged estimated', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 8_000 })],
      teamLabor: [crewRow('j1', 60, 1800)],
      subLabor: [sub({ jobId: 'j1', cost: 3000, hours: 20 })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(paige?.hours).toBeCloseTo(20)
    expect(paige?.billing).toBeCloseTo(8000 * (20 / 80))
    expect(paige?.hasEstimatedBilling).toBe(false)
  })

  it('unlinked sheets keep cost-only behavior (no billing) and imputed hours', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 10_000 })],
      teamLabor: [],
      subLabor: [sub({ jobId: null })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(paige?.billing).toBe(0)
    expect(paige?.laborCost).toBeCloseTo(3000)
    expect(paige?.hours).toBeCloseTo(100)
  })

  it('sub equivalent hours suppress the equal-split fallback on their job', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 6_000, teamMembers: [{ userId: 'user-mike', userName: 'Mike Z' }], fallbackDate: '2026-06-10' })],
      teamLabor: [],
      subLabor: [sub({ jobId: 'j1', cost: 600 })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const mike = summary.rows.find((r) => r.displayName === 'Mike Z')
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(mike?.billing ?? 0).toBe(0) // no fallback share — hours-weighted world now
    expect(paige?.billing).toBeCloseTo(6000)
  })
})
