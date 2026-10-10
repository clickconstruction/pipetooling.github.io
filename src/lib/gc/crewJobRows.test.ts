import { describe, expect, it } from 'vitest'
import { crewJobsHeld, crewPercentOf, generalConditionsHolder, heldByOthers, withCrewPercents, type CrewJobRead, type CrewStageRow } from './crewJobRows'
import { crewPctFromStages, ownCrewWork } from './building'
import { initialGcState } from './schedule/testState'

/** Fair Oaks D's plumbing, our own crew: Underground, Rough in, Top out and Trim (fplumb-1 to fplumb-4). */
const state = () => initialGcState()
const plumbing = () => state().projects.find((p) => p.id === 'fairoaksd')!.packages.find((k) => k.id === 'fplumb')!

function stage(name: string, pct: number | null, at: string | null, weight = 25): CrewStageRow {
  return { fixture_id: name, name, stage_kind: 'any', sequence_order: 0, weight_pct: weight, progress_pct: pct, progress_at: at, draw_paid: false }
}
function read(over: Partial<CrewJobRead> = {}): CrewJobRead {
  return { packageId: 'fplumb', jobId: 'job-1088', label: 'J 1088', name: 'Fair Oaks D plumbing', stages: [], reportPct: null, reportedOn: null, pctComplete: null, ...over }
}
const fourStages = [
  stage('Underground', 100, '2026-09-02T15:00:00Z'),
  stage('Rough In', 60, '2026-10-06T15:00:00Z'),
  stage('Top Out', 0, null),
  stage('Trim Set', null, null),
]

describe('crewPercentOf', () => {
  it('reads each stage line from the job’s stage of the same rank, with the day it was reported', () => {
    const pct = crewPercentOf(plumbing(), read({ stages: fourStages }))
    expect(pct).toEqual({
      from: 'stages',
      pctByLine: { 'fplumb-1': 100, 'fplumb-2': 60, 'fplumb-3': 0, 'fplumb-4': 0 },
      pctDone: crewPctFromStages(plumbing(), { 'fplumb-1': 100, 'fplumb-2': 60, 'fplumb-3': 0, 'fplumb-4': 0 }),
      reportedByLine: { 'fplumb-1': '2026-09-02', 'fplumb-2': '2026-10-06', 'fplumb-3': null, 'fplumb-4': null },
      reportedOn: '2026-10-06',
    })
  })

  it('averages two stages of one rank by their share of the job', () => {
    const stages = [fourStages[0]!, stage('Rough In · Building A', 100, '2026-10-01T15:00:00Z', 30), stage('Rough In · Building B', 20, '2026-10-02T15:00:00Z', 10), fourStages[2]!, fourStages[3]!]
    const pct = crewPercentOf(plumbing(), read({ stages }))
    expect(pct.from === 'stages' && pct.pctByLine['fplumb-2']).toBe(80)
  })

  it('reads the whole job when a stage line has no stage of its rank: the crew report while it is the newest word', () => {
    const pct = crewPercentOf(plumbing(), read({ stages: fourStages.slice(0, 3), reportPct: 55, reportedOn: '2026-10-08', pctComplete: 40 }))
    expect(pct).toEqual({ from: 'report', pctDone: 55, reportedByLine: {}, reportedOn: '2026-10-08' })
  })

  it('reads the job’s own percent when no stage was reported, or no report is current', () => {
    const unreported = [stage('Underground', null, null), stage('Rough In', null, null), stage('Top Out', null, null), stage('Trim', null, null)]
    expect(crewPercentOf(plumbing(), read({ stages: unreported, pctComplete: 30 }))).toEqual({ from: 'job', pctDone: 30, reportedByLine: {}, reportedOn: null })
    expect(crewPercentOf(plumbing(), read({ pctComplete: 70 }))).toEqual({ from: 'job', pctDone: 70, reportedByLine: {}, reportedOn: null })
  })

  it('reads nothing when the job has no stage reported, no report and no percent, never a measured zero (gc 5)', () => {
    expect(crewPercentOf(plumbing(), read({ stages: [stage('Underground', null, null)] }))).toEqual({ from: 'none', reportedByLine: {}, reportedOn: null })
  })
})

describe('withCrewPercents', () => {
  it('lays the stages into our crew’s trade, with where they came from, so Draws and the bill read one number', () => {
    const s = withCrewPercents(state(), [read({ stages: fourStages })])
    const pkg = s.projects.find((p) => p.id === 'fairoaksd')!.packages.find((k) => k.id === 'fplumb')!
    expect(pkg.selfPerform?.pctByLine).toEqual({ 'fplumb-1': 100, 'fplumb-2': 60, 'fplumb-3': 0, 'fplumb-4': 0 })
    expect(pkg.selfPerform?.source).toEqual({ from: 'stages', job: 'J 1088', on: '2026-10-06' })
    expect(ownCrewWork(pkg)?.pct).toBe(Math.round(crewPctFromStages(pkg, pkg.selfPerform!.pctByLine!)))
  })

  it('reads the whole job as one number, dropping the stages it had', () => {
    const s = withCrewPercents(state(), [read({ reportPct: 55, reportedOn: '2026-10-08' })])
    const self = s.projects.find((p) => p.id === 'fairoaksd')!.packages.find((k) => k.id === 'fplumb')!.selfPerform!
    expect(self.pctByLine).toBeUndefined()
    expect(self.pctDone).toBe(55)
    expect(self.source).toEqual({ from: 'report', job: 'J 1088', on: '2026-10-08' })
  })

  it('leaves a trade with nothing read, an unlinked trade, a hired trade and every other job as they were', () => {
    const before = state()
    const fairOaks = before.projects.find((p) => p.id === 'fairoaksd')!
    expect(withCrewPercents(before, [read()]).projects.find((p) => p.id === 'fairoaksd')).toBe(fairOaks)
    expect(withCrewPercents(before, [read({ packageId: 'felec', pctComplete: 50 })]).projects.find((p) => p.id === 'fairoaksd')).toBe(fairOaks)
    const laid = withCrewPercents(before, [read({ pctComplete: 50 })])
    expect(laid.projects.find((p) => p.id === 'stoneoak')).toBe(before.projects.find((p) => p.id === 'stoneoak'))
    expect(withCrewPercents(before, [])).toBe(before)
  })
})

describe('one Pipeline job per crew trade (call 11, amendment 3)', () => {
  const projects = [
    { id: 'p1', name: 'Hill Country Clinic', trades: [{ id: 'k3', trade: 'Plumbing', ours: true, jobLedgerId: 'job-7' }, { id: 'k4', trade: 'Electrical', ours: true, jobLedgerId: 'job-8' }, { id: 'k1', trade: 'Sitework', ours: false, jobLedgerId: null }] },
    { id: 'p2', name: 'Stone Oak', trades: [{ id: 's3', trade: 'Plumbing', ours: true, jobLedgerId: 'job-9' }, { id: 's4', trade: 'HVAC', ours: true }] },
  ]

  it('names each held job by its trade on this GC job, and by its trade and job on another', () => {
    expect(crewJobsHeld(projects, 'p1')).toEqual([
      { jobId: 'job-7', packageId: 'k3', words: 'Plumbing' },
      { jobId: 'job-8', packageId: 'k4', words: 'Electrical' },
      { jobId: 'job-9', packageId: 's3', words: 'Plumbing at Stone Oak' },
    ])
  })

  it('leaves out the trade’s own job, so its picker can keep it', () => {
    expect(heldByOthers(crewJobsHeld(projects, 'p1'), 'k3')).toEqual({ 'job-8': 'Electrical', 'job-9': 'Plumbing at Stone Oak' })
  })

  it('holds each project’s general conditions job too, on every crew’s picker and the other projects’ (O11b)', () => {
    const held = crewJobsHeld(projects, 'p1', { p1: 'job-gc1', p2: 'job-gc2' })
    expect(held.filter((h) => h.packageId.startsWith('general-conditions'))).toEqual([
      { jobId: 'job-gc1', packageId: generalConditionsHolder('p1'), words: 'general conditions' },
      { jobId: 'job-gc2', packageId: generalConditionsHolder('p2'), words: 'general conditions at Stone Oak' },
    ])
    expect(heldByOthers(held, 'k3')).toEqual({ 'job-8': 'Electrical', 'job-9': 'Plumbing at Stone Oak', 'job-gc1': 'general conditions', 'job-gc2': 'general conditions at Stone Oak' })
    // Our number's picker on p1 keeps its own general conditions job and holds every crew's and p2's.
    expect(heldByOthers(held, generalConditionsHolder('p1'))).toEqual({ 'job-7': 'Plumbing', 'job-8': 'Electrical', 'job-9': 'Plumbing at Stone Oak', 'job-gc2': 'general conditions at Stone Oak' })
  })
})
