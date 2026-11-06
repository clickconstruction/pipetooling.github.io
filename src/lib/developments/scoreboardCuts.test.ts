import { describe, expect, it } from 'vitest'
import type { MemberJob } from './overview'
import type { SiteLaborRead } from './siteLabor'
import { buildScoreboard } from './scoreboard'
import { isScoreboardCut, isScoreboardWindowKey, personJobsWords, scoreboardPartGroups, scoreboardPeopleCut, scoreboardWindowRange, scoreboardWindowWords, sumScoreboardRows } from './scoreboardCuts'

function job(over: Partial<MemberJob> & { id: string }): MemberJob {
  return {
    hcp_number: null, click_number: over.id.replace('j', ''), job_name: `Job ${over.id}`, job_address: null, customer_id: null, customer_name: null, gc_customer_id: null,
    development_id: 'd1', bid_id: null, status: 'working', revenue: 0, payments_made: 0, pct_complete: null, last_work_date: null, last_bill_date: null, job_plans_link: null,
    created_at: null, updated_at: null, ...over,
  } as MemberJob
}
const label = (j: MemberJob) => `JP${j.click_number}`
const day = (ymd: string, hours: number, costUsd: number) => ({ ymd, hours, costUsd })
const jobs = [
  job({ id: 'j1', status: 'paid', revenue: 100000, plan_part_id: 'lodge' }),
  job({ id: 'j2', status: 'working', revenue: 20000, pct_complete: 50, plan_part_id: 'bunker' }),
  job({ id: 'j3', status: 'working', revenue: 8000, pct_complete: 100 }),
  job({ id: 'j4', status: 'waiting', revenue: 0, plan_part_id: 'lodge' }),
]
const labor: SiteLaborRead = {
  state: 'read',
  labor: {
    byJobId: new Map([
      ['j1', { jobId: 'j1', hours: 100, costUsd: 3000, days: 2, people: [{ personName: 'Luis Ortega', personId: 'p1', userId: 'u1', hours: 75, costUsd: 2250, days: 2, leadDays: 2, byWorkDate: [day('2026-11-02', 40, 1200), day('2026-11-03', 35, 1050)] }, { personName: 'Ana Reyes', personId: 'p2', userId: null, hours: 25, costUsd: 750, days: 1, leadDays: 0, byWorkDate: [day('2026-11-03', 25, 750)] }] }],
      ['j2', { jobId: 'j2', hours: 10, costUsd: 300, days: 1, people: [{ personName: 'Ana Reyes', personId: 'p2', userId: null, hours: 10, costUsd: 300, days: 1, leadDays: 0, byWorkDate: [day('2026-11-03', 10, 300)] }] }],
      ['j3', { jobId: 'j3', hours: 20, costUsd: 600, days: 1, people: [{ personName: 'Luis Ortega', personId: 'p1', userId: 'u1', hours: 20, costUsd: 600, days: 1, leadDays: 0, byWorkDate: [day('2026-10-01', 20, 600)] }] }],
    ]),
    siteDays: 3,
    people: 2,
    daysKnown: true,
  },
}
const parts = [
  { id: 'lodge', name: 'The lodge' },
  { id: 'bunker', name: 'The bunker' },
  { id: 'empty-part', name: 'The site' },
]
const partOf = new Map(jobs.map((j) => [j.id, j.plan_part_id ?? null]))
const model = () => buildScoreboard({ jobs, invoices: [], jobLabel: label, labor })

describe('the window keys and ranges', () => {
  it('this month runs from the first to today, 90 days back from today with today inside, all time is no window', () => {
    expect(scoreboardWindowRange('month', '2026-11-05')).toEqual({ from: '2026-11-01', to: '2026-11-05' })
    expect(scoreboardWindowRange('90d', '2026-11-05')).toEqual({ from: '2026-08-08', to: '2026-11-05' })
    expect(scoreboardWindowRange('90d', '2026-02-10')).toEqual({ from: '2025-11-13', to: '2026-02-10' })
    expect(scoreboardWindowRange('all', '2026-11-05')).toBeNull()
  })
  it('words the window as two days, with the years when they differ', () => {
    expect(scoreboardWindowWords({ from: '2026-11-01', to: '2026-11-05' })).toBe('Nov 1 – Nov 5')
    expect(scoreboardWindowWords({ from: '2025-11-13', to: '2026-02-10' })).toBe('Nov 13 2025 – Feb 10 2026')
  })
  it('reads only its own keys back', () => {
    expect(isScoreboardCut('part')).toBe(true)
    expect(isScoreboardCut('team')).toBe(false)
    expect(isScoreboardWindowKey('90d')).toBe(true)
    expect(isScoreboardWindowKey(null)).toBe(false)
  })
})

describe('the cut by part of the site', () => {
  it('groups the rows by part in the parts’ order, leaves out a part with no job with money, and puts the jobs on no part last', () => {
    const groups = scoreboardPartGroups(model(), partOf, parts)
    expect(groups.map((g) => [g.key, g.name, g.rows.map((r) => r.jobId)])).toEqual([
      ['lodge', 'The lodge', ['j1']],
      ['bunker', 'The bunker', ['j2']],
      ['none', 'No part', ['j3']],
    ])
  })
  it('a group’s nine are its rows together, days counted once across them', () => {
    const m = model()
    const rows = m.rows.filter((r) => r.jobId === 'j1' || r.jobId === 'j2')
    const sum = sumScoreboardRows(rows)
    expect(sum.hours).toBe(110)
    expect(sum.labor).toBe(3300)
    // Nov 3 is on both jobs: two days, not three.
    expect(sum.days).toBe(2)
    expect(sum.earned).toBe(110000)
    // A row with no day keys adds its days as they are.
    expect(sumScoreboardRows([{ m: rows[0]!.m, dayKeys: null }, rows[1]!]).days).toBe(rows[0]!.m.days + 1)
  })
  it('a job on a part the site no longer lists reads as no part', () => {
    const groups = scoreboardPartGroups(model(), new Map([['j1', 'gone']]), parts)
    expect(groups.map((g) => g.key)).toEqual(['none'])
  })
})

describe('the cut by person', () => {
  it('turns the grid over: a person is the row with their hours, days and labor across the jobs, and their share of each job’s earned by hours', () => {
    const people = scoreboardPeopleCut({ model: model(), labor, seesCosts: true, viewer: { userId: 'u1', name: null } })
    expect(people.map((p) => p.name)).toEqual(['Luis Ortega', 'Ana Reyes'])
    const luis = people[0]!
    expect(luis.you).toBe(true)
    expect(luis.m).toEqual({ hours: 95, days: 3, labor: 2850, cost: 2850, earned: 75000 + 8000 })
    expect(luis.lines.map((l) => [l.row.jobId, l.lead, l.m.earned])).toEqual([
      ['j1', true, 75000],
      ['j3', false, 8000],
    ])
    const ana = people[1]!
    expect(ana.m).toEqual({ hours: 35, days: 1, labor: 1050, cost: 1050, earned: 25000 + 10000 })
    // The shares on one job add up to the job's earned dollars.
    expect(luis.lines[0]!.m.earned + ana.lines[0]!.m.earned).toBe(100000)
  })
  it('the leader’s board carries no dollar of labor, and the viewer with no login is found by name', () => {
    const people = scoreboardPeopleCut({ model: model(), labor, seesCosts: false, viewer: { userId: null, name: 'ana reyes' } })
    const ana = people.find((p) => p.name === 'Ana Reyes')!
    expect(ana.you).toBe(true)
    expect(ana.m.labor).toBeNull()
    expect(ana.m.cost).toBeNull()
    expect(people.find((p) => p.name === 'Luis Ortega')!.you).toBe(false)
  })
  it('in a window a person carries the hours inside it alone, and a person with none inside is not a row', () => {
    const m = buildScoreboard({ jobs, invoices: [], jobLabel: label, labor, window: { from: '2026-11-02', to: '2026-11-02' } })
    const people = scoreboardPeopleCut({ model: m, labor, seesCosts: true, viewer: { userId: null, name: null } })
    expect(people.map((p) => [p.name, p.m.hours, p.m.days])).toEqual([['Luis Ortega', 40, 1]])
    expect(people[0]!.lines).toHaveLength(1)
  })
  it('follows the board’s sort where a person fills the column, else earned biggest first', () => {
    const byHours = scoreboardPeopleCut({ model: model(), labor, seesCosts: true, viewer: { userId: null, name: null }, sort: { key: 'hours', desc: false } })
    expect(byHours.map((p) => p.name)).toEqual(['Ana Reyes', 'Luis Ortega'])
    const bySubs = scoreboardPeopleCut({ model: model(), labor, seesCosts: true, viewer: { userId: null, name: null }, sort: { key: 'subs', desc: true } })
    expect(bySubs.map((p) => p.name)).toEqual(['Luis Ortega', 'Ana Reyes'])
    expect(personJobsWords(1)).toBe('1 job')
    expect(personJobsWords(3)).toBe('3 jobs')
  })
  it('is empty until the clock has read', () => {
    expect(scoreboardPeopleCut({ model: buildScoreboard({ jobs, invoices: [], jobLabel: label }), labor: undefined, seesCosts: true, viewer: { userId: null, name: null } })).toEqual([])
  })
})
