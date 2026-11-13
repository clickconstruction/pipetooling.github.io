import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../../plainWords'
import type { BuildJob, PctPoint } from '../buildPace'
import type { VectorSession } from '../vectors'
import { buildBuildDesk, type BuildDeskInput } from './buildDesk'
import { BUILD_STEP_SHOWN, buildBuildSteps, type BuildSteps } from './buildSteps'

const TODAY = '2026-10-26'
const job = (id: string, name: string, revenueUsd: number | null, pctComplete: number | null): BuildJob => ({ id, label: `${id} · ${name}`, hcpNumber: id, jobName: name, revenueUsd, pctComplete, status: 'working', createdYmd: '2026-07-01' })
const pt = (jobId: string, atYmd: string, pct: number, source: PctPoint['source'] = 'hand'): PctPoint => ({ jobId, atYmd, pct, source })
const sess = (jobId: string, workDate: string, hours: number): VectorSession => ({ userId: 'u1', workDate, hours, jobId, onBid: false, officeJob: false, approved: true, pending: false })

/** Made-up jobs on 2026-10-26: the window is Oct 13 to 26. */
const input: BuildDeskInput = {
  openJobs: [
    job('2114', 'Pine Fork creekside', 20_000, 30),
    job('2101', 'Ridgeway tower', 71_000, 45),
    job('2120', 'Cedar Bend annex', 50_000, null),
    job('2141', 'Sink swap', null, null),
    job('2140', 'Walkthrough', null, null),
    job('2090', 'Mill Road duplex', 30_000, 50),
    job('2087', 'Oak Hollow clubhouse', 124_000, 62),
    job('2095', 'Quarry Lane shop', null, null),
    job('2096', 'Birch Court', 40_000, null),
    job('2150', 'Harbor View lofts', 170_000, 60),
    job('2160', 'Elm Street pretest', 32_000, 100),
  ],
  points: [pt('2101', '2026-09-28', 45), pt('2114', '2026-09-10', 30), pt('2087', '2026-09-01', 62), pt('2090', '2026-08-01', 50), pt('2150', '2026-09-30', 48), pt('2150', '2026-10-20', 60, 'report'), pt('2160', '2026-10-01', 90), pt('2160', '2026-10-22', 100, 'report')],
  sessions: [sess('2101', '2026-10-14', 22), sess('2114', '2026-10-15', 9), sess('2120', '2026-10-16', 4), sess('2140', '2026-10-15', 7), sess('2141', '2026-10-19', 1), sess('2087', '2026-10-07', 8), sess('2096', '2026-10-01', 5), sess('2150', '2026-10-13', 82), sess('2160', '2026-10-21', 14)],
  todayYmd: TODAY,
  reads: null,
  paces: null,
  outPerWeekUsd: null,
  weeks: null,
}
const steps = buildBuildSteps(buildBuildDesk(input))

/** Every sentence the kernel writes. The group names and the job labels are labels, not sentences. */
const sentences = (s: BuildSteps): string[] => [s.headline, s.line, s.nothingWaiting, s.moved.words, ...s.counted, ...s.groups.flatMap((g) => g.rows.map((r) => r.sub))].filter(Boolean)

describe('buildBuildSteps (punch list #334, PR 1)', () => {
  it('says where Build stands in one headline and one line', () => {
    expect(steps.headline).toBe('The field put in 139 hours. Only $23.6k of work shows as done.')
    expect(steps.line).toBe('Most of that gap is percents nobody updated.')
    expect(steps.nothingWaiting).toBe('')
  })

  it('names three lists by what to do, with the count and the money', () => {
    expect(steps.groups.map((g) => g.title)).toEqual(['Hours went in, the percent did not move · 3 jobs', 'Hours on a job with no price · 2 jobs', 'Sold, and nobody on it · 4 jobs, $62.1k'])
    expect(steps.groups.map((g) => g.shown)).toEqual([2, 1, 1])
    expect(BUILD_STEP_SHOWN).toEqual({ percent: 2, price: 1, crew: 1 })
  })

  it('lists the jobs whose hours moved no percent, the most hours first, each opening its detail', () => {
    const rows = steps.groups[0].rows
    expect(rows.map((r) => [r.title, r.sub, r.press, r.href])).toEqual([
      ['2101 · Ridgeway tower', '22 hours. Still 45%.', 'Set the percent', null],
      ['2114 · Pine Fork creekside', '9 hours. Still 30%.', 'Set the percent', null],
      ['2120 · Cedar Bend annex', '4 hours. No percent yet.', 'Set the percent', null],
    ])
    expect(rows.every((r) => r.row.canSetPct)).toBe(true)
  })

  it('lists the jobs with hours and no price, each press the job’s own price door', () => {
    expect(steps.groups[1].rows.map((r) => [r.title, r.sub, r.press, r.href])).toEqual([
      ['2140 · Walkthrough', '7 hours earn nothing until it has a price.', 'Set a price', '/jobs?tab=stages&edit=2140'],
      ['2141 · Sink swap', '1 hour earns nothing until it has a price.', 'Set a price', '/jobs?tab=stages&edit=2141'],
    ])
  })

  it('lists the sold jobs nobody is on, the most money left first, and prices a job before it is crewed', () => {
    expect(steps.groups[2].rows.map((r) => [r.title, r.sub, r.press, r.href])).toEqual([
      ['2087 · Oak Hollow clubhouse', '$47.1k left. 19 days quiet.', 'Schedule it', null],
      ['2090 · Mill Road duplex', '$15k left. No hours in 13 weeks.', 'Schedule it', null],
      ['2095 · Quarry Lane shop', 'No price yet. No hours in 13 weeks.', 'Set a price', '/jobs?tab=stages&edit=2095'],
      ['2096 · Birch Court', '$40k contract, no percent yet. 25 days quiet.', 'Schedule it', null],
    ])
  })

  it('puts the jobs that moved behind their own press, a finished one included, and counts every open job', () => {
    expect(steps.moved.label).toBe('What moved (2)')
    expect(steps.moved.rows.map((r) => r.label)).toEqual(['2150 · Harbor View lofts', '2160 · Elm Street pretest'])
    expect(steps.moved.words).toBe('2 jobs moved $23.6k in the last 14 days. The hours and the percent agree.')
    expect(steps.everyLabel).toBe('Every open job (11)')
  })

  it('places every open job in a list or behind What moved, and none twice', () => {
    const desk = buildBuildDesk(input)
    const placed = [...steps.groups.flatMap((g) => g.rows.map((r) => r.id)), ...steps.moved.rows.map((r) => r.id)]
    expect(new Set(placed).size).toBe(placed.length)
    expect(placed.slice().sort()).toEqual(desk.rows.map((r) => r.id).sort())
  })

  it('names the no-price hours when they are most of the gap', () => {
    const s = buildBuildSteps(buildBuildDesk({ ...input, sessions: [sess('2101', '2026-10-14', 3), sess('2140', '2026-10-15', 30)] }))
    expect(s.line).toBe('Most of that gap is hours on jobs with no price.')
    const onlyPrice = buildBuildSteps(buildBuildDesk({ ...input, openJobs: [job('2140', 'Walkthrough', null, null)], sessions: [sess('2140', '2026-10-15', 0.2)] }))
    expect(onlyPrice.line).toBe('Most of that gap is hours on jobs with no price.')
    expect(onlyPrice.groups[1].rows[0]!.sub).toBe('Under 1 hour earns nothing until it has a price.')
  })

  it('drops Only and the line when every job with hours moved, and says nothing waits', () => {
    const moving = buildBuildSteps(buildBuildDesk({ ...input, openJobs: [job('2150', 'Harbor View lofts', 170_000, 60)], sessions: [sess('2150', '2026-10-13', 82)] }))
    expect(moving.headline).toBe('The field put in 82 hours. $20.4k of work shows as done.')
    expect(moving.line).toBe('')
    expect(moving.nothingWaiting).toBe('Nothing waiting on Build. Every job with hours moved its percent.')
    const none = buildBuildSteps(buildBuildDesk({ ...input, openJobs: [], sessions: [] }))
    expect(none.headline).toBe('The field put in 0 hours. $0 of work shows as done.')
    expect(none.nothingWaiting).toBe('Nothing waiting on Build. There is no open job to read.')
    expect(none.moved.label).toBe('What moved (0)')
    expect(none.moved.words).toBe('Nothing moved in the last 14 days. A job shows here when its percent goes up.')
    for (const s of [moving, none]) for (const text of sentences(s)) expect(plainWordsFailures(text), text).toEqual([])
  })

  it('writes How this is counted in plain words, with no database name', () => {
    const all = steps.counted.join(' ')
    expect(all).not.toMatch(/_|job_pct_events|ledger/)
    expect(steps.counted[0]).toBe('Hours are each job’s clock hours over the last 14 days.')
    expect(all).toContain('The crew on a job comes from the Schedule for the next 7 days.')
  })

  it('holds every sentence to the plain-words rule', () => {
    for (const text of sentences(steps)) expect(plainWordsFailures(text), text).toEqual([])
  })
})
