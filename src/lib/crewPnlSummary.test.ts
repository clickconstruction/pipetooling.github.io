import { describe, expect, it } from 'vitest'
import {
  buildCrewPnlPersonResolver,
  compareCrewPnlRows,
  crewPnlRangeForPreset,
  crewPnlRowIsEstimateLed,
  buildCrewPnlSummary,
  looseCrewPnlName,
  resolveCrewPnlNameLoosely,
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
  it('keyForPerson: stored people.id wins outright, even over a mismatched display name (C-1)', () => {
    const r = buildCrewPnlPersonResolver(people)
    const k = r.keyForPerson('per-mike', 'Totally Renamed')
    expect(k).toBe('p:per-mike')
    expect(r.displayName(k)).toBe('Mike Z')
    expect(r.isUnmatched(k)).toBe(false)
  })
  it('keyForPerson: id not on the roster still keys by id (archived person), display from fallback', () => {
    const r = buildCrewPnlPersonResolver(people)
    const k = r.keyForPerson('per-ghost', 'Old Timer')
    expect(k).toBe('p:per-ghost')
    expect(r.displayName(k)).toBe('Old Timer')
    expect(r.isUnmatched(k)).toBe(false)
  })
  it('keyForPerson: null id falls back to name matching', () => {
    const r = buildCrewPnlPersonResolver(people)
    expect(r.keyForPerson(null, 'mike z')).toBe('p:per-mike')
    expect(r.keyForPerson(undefined, 'Stray Person')).toBe('n:stray person')
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
    const s = buildCrewPnlSummary({ jobs: [], teamLabor, subLabor, people, range: ALL, subLaborEquivalentRate: 30 })
    const mike = s.rows.find((r) => r.key === 'p:per-mike')!
    expect(mike.laborCost).toBeCloseTo(240 + 200, 5) // crew cost + sub share
    // v2.977: sub hours are dollar-derived ($400 ÷ $30/hr = 13.33 eq hours, half each), not sheet unit-hours.
    expect(mike.hours).toBeCloseTo(8 + 400 / 30 / 2, 5)
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

  it('dollars always win (v2.977): sheet unit-hours never dilute the share', () => {
    // $3,000 at $30/hr = 100 equivalent hours even though the sheet lists 20 unit-hours.
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 8_000 })],
      teamLabor: [crewRow('j1', 60, 1800)],
      subLabor: [sub({ jobId: 'j1', cost: 3000, hours: 20 })],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(paige?.hours).toBeCloseTo(100)
    expect(paige?.billing).toBeCloseTo(8000 * (100 / 160))
    expect(paige?.hasEstimatedBilling).toBe(true)
  })

  it('reports the linkage audit: totals, linked share, and unlinked sheet details', () => {
    const summary = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 8_000 })],
      teamLabor: [],
      subLabor: [
        sub({ id: 's-linked', jobId: 'j1', cost: 3000 }),
        sub({ id: 's-lost', jobId: null, cost: 1200, jobNumberText: 'HCP 769' }),
      ],
      people,
      range: ALL,
      subLaborEquivalentRate: 30,
    })
    expect(summary.subLabor.total).toBeCloseTo(4200)
    expect(summary.subLabor.linkedTotal).toBeCloseTo(3000)
    expect(summary.subLabor.unlinkedSheets).toEqual([
      { id: 's-lost', jobNumberText: 'HCP 769', assignedNames: ['Paige'], cost: 1200 },
    ])
    const paige = summary.rows.find((r) => r.displayName === 'Paige')
    expect(paige?.unlinkedSubCost).toBeCloseTo(1200)
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

describe('loose name resolution (B8, J8-F2)', () => {
  const roster: CrewPnlRosterPerson[] = [
    { id: 'per-jose', name: 'José Luis García', accountUserId: null },
    { id: 'per-mike', name: 'Mike Z', accountUserId: 'user-mike' },
    { id: 'per-sr', name: 'Tom Reed Sr', accountUserId: null },
    { id: 'per-jr', name: 'Tom Reed Jr', accountUserId: null },
    { id: 'per-solo', name: 'Marco', accountUserId: null },
  ]

  it('looseCrewPnlName drops diacritics and punctuation and collapses spaces', () => {
    expect(looseCrewPnlName('  José  Luis García. ')).toBe('jose luis garcia')
    expect(looseCrewPnlName("O'Brien, Pat")).toBe('o brien pat')
    expect(looseCrewPnlName(null)).toBe('')
  })

  it('a spelling that differs only by accents or punctuation lands on the roster person', () => {
    expect(resolveCrewPnlNameLoosely('jose luis garcia', roster)?.id).toBe('per-jose')
    expect(resolveCrewPnlNameLoosely('Jose Luis Garcia.', roster)?.id).toBe('per-jose')
  })

  it('a shorter or reordered spelling merges when only one roster name contains it', () => {
    expect(resolveCrewPnlNameLoosely('Jose Garcia', roster)?.id).toBe('per-jose')
    expect(resolveCrewPnlNameLoosely('Garcia, Jose', roster)?.id).toBe('per-jose')
    expect(resolveCrewPnlNameLoosely('J. Garcia', roster)?.id).toBe('per-jose')
    // The free text may also be the longer one.
    expect(resolveCrewPnlNameLoosely('Mike Z (sub)', roster)?.id).toBe('per-mike')
  })

  it('two possible people is ambiguous — stays unmatched rather than moving money to the wrong one', () => {
    expect(resolveCrewPnlNameLoosely('Tom Reed', roster)).toBeNull()
    expect(resolveCrewPnlNameLoosely('T. Reed', roster)).toBeNull()
  })

  it('single first names never merge by containment; a lone roster name matches only by loose equality', () => {
    expect(resolveCrewPnlNameLoosely('Jose', roster)).toBeNull()
    expect(resolveCrewPnlNameLoosely('Garcia', roster)).toBeNull()
    expect(resolveCrewPnlNameLoosely('MARCO', roster)?.id).toBe('per-solo')
    expect(resolveCrewPnlNameLoosely('Marco Polo', roster)).toBeNull()
  })

  it('the resolver keys a loose match on the roster person and shows the roster spelling', () => {
    const r = buildCrewPnlPersonResolver(roster)
    const k = r.keyForName('jose garcia')
    expect(k).toBe('p:per-jose')
    expect(r.displayName(k)).toBe('José Luis García')
    expect(r.isUnmatched(k)).toBe(false)
    const amb = r.keyForName('Tom Reed')
    expect(amb).toBe('n:tom reed')
    expect(r.isUnmatched(amb)).toBe(true)
  })

  it('one person stays one row: a sub sheet under a loose spelling merges into the clocked row', () => {
    const s = buildCrewPnlSummary({
      jobs: [job({ id: 'j1', revenue: 1000 })],
      teamLabor: [{ jobId: 'j1', breakdown: [{ personName: 'José Luis García', byWorkDate: [{ workDate: '2026-06-01', hours: 10, cost: 300 }] }] }],
      subLabor: [{ id: 's1', jobId: 'j1', jobLabel: 'Sub sheet 769', jobDate: '2026-06-02', assignedNames: ['Garcia, Jose'], cost: 500, hours: 0 }],
      people: roster,
      range: ALL,
      subLaborEquivalentRate: 50,
    })
    expect(s.rows).toHaveLength(1)
    expect(s.rows[0]?.key).toBe('p:per-jose')
    expect(s.rows[0]?.unmatched).toBe(false)
    expect(s.rows[0]?.perJob.map((l) => l.kind)).toEqual(['crew', 'sub'])
  })
})

describe('estimate-led rows and the banded sort (B8, J8-F1 / N1)', () => {
  const twoJobs: CrewPnlJobInput[] = [
    // j1: real clocked work, $1,000.
    job({ id: 'j1', jobLabel: '769', revenue: 1000 }),
    // j2: revenue but no hours at all → equal split among team members.
    job({ id: 'j2', jobLabel: '770', revenue: 9000, teamMembers: [{ userId: 'user-mike', userName: 'Mike Z' }, { userId: null, userName: 'Ghost' }], fallbackDate: '2026-06-03' }),
  ]
  const teamLabor: CrewPnlTeamLaborInput[] = [
    {
      jobId: 'j1',
      breakdown: [
        { personName: 'Mike Z', byWorkDate: [{ workDate: '2026-06-01', hours: 8, cost: 240 }] },
        { personName: 'Paige', byWorkDate: [{ workDate: '2026-06-01', hours: 2, cost: 50 }] },
      ],
    },
  ]
  const summary = () => buildCrewPnlSummary({ jobs: twoJobs, teamLabor, subLabor: [], people, range: ALL })

  it('crewPnlRowIsEstimateLed: guesses at or above half the billing, never a row with no guess', () => {
    expect(crewPnlRowIsEstimateLed(0, 500)).toBe(false)
    expect(crewPnlRowIsEstimateLed(100, 500)).toBe(false)
    expect(crewPnlRowIsEstimateLed(250, 500)).toBe(true)
    expect(crewPnlRowIsEstimateLed(500, 500)).toBe(true)
  })

  it('rows report their equal-split dollars and whether the guess leads', () => {
    const s = summary()
    const mike = s.rows.find((r) => r.key === 'p:per-mike')
    const paige = s.rows.find((r) => r.key === 'p:per-paige')
    const ghost = s.rows.find((r) => r.key === 'n:ghost')
    expect(mike?.fallbackBilling).toBe(4500)
    expect(mike?.estimateLed).toBe(true) // 4,500 of 5,300 is a guess — the live rank-#1 shape
    expect(paige?.fallbackBilling).toBe(0)
    expect(paige?.estimateLed).toBe(false)
    expect(ghost?.hours).toBe(0)
    expect(ghost?.estimateLed).toBe(true) // no hours, no cost, pure fallback — the live rank-#4 shape
  })

  it('the kernel order and every numeric sort put real rows first, in both directions', () => {
    const s = summary()
    expect(s.rows.map((r) => r.key)).toEqual(['p:per-paige', 'p:per-mike', 'n:ghost'])
    const byRateDesc = [...s.rows].sort((a, b) => compareCrewPnlRows(a, b, 'rate', 'desc')).map((r) => r.key)
    expect(byRateDesc[0]).toBe('p:per-paige')
    const byProfitAsc = [...s.rows].sort((a, b) => compareCrewPnlRows(a, b, 'profit', 'asc')).map((r) => r.key)
    expect(byProfitAsc).toEqual(['p:per-paige', 'n:ghost', 'p:per-mike'])
    const byHoursDesc = [...s.rows].sort((a, b) => compareCrewPnlRows(a, b, 'hours', 'desc')).map((r) => r.key)
    expect(byHoursDesc).toEqual(['p:per-paige', 'p:per-mike', 'n:ghost'])
  })

  it('the name sort is a lookup, not a ranking — plain alphabetical, no bands', () => {
    const s = summary()
    const asc = [...s.rows].sort((a, b) => compareCrewPnlRows(a, b, 'name', 'asc')).map((r) => r.displayName)
    expect(asc).toEqual(['Ghost', 'Mike Z', 'Paige'])
  })

  it('ties inside a band break by name so the order is stable', () => {
    const s = summary()
    const paige = s.rows.find((r) => r.key === 'p:per-paige')!
    const twin = { ...paige, key: 'p:twin', displayName: 'Aaron' }
    expect(compareCrewPnlRows(paige, twin, 'profit', 'desc')).toBeGreaterThan(0)
  })
})
