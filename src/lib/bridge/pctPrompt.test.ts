import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { buildBuildPace, type BuildJob, type BuildPaceInput } from './buildPace'
import { PCT_PROMPT_DONE_LINE, buildPctPrompt, isGreyJob, withPctSet } from './pctPrompt'

const job = (id: string, revenueUsd: number | null, pctComplete: number | null, extra: Partial<BuildJob> = {}): BuildJob => ({
  id,
  label: `J${id} · Job ${id}`,
  hcpNumber: `J${id}`,
  jobName: `Job ${id}`,
  revenueUsd,
  pctComplete,
  status: 'working',
  createdYmd: '2026-07-01',
  ...extra,
})

const open = [
  job('1', 120_000, null),
  job('2', 280_000, null),
  job('3', 90_000, 40),
  job('4', null, null), // no contract: not the Build card's grey
  job('5', 0, null),
]
const none = new Map<string, number>()

describe('buildPctPrompt', () => {
  it('lists the open jobs with a contract and no %, biggest first, with the strip line', () => {
    const p = buildPctPrompt(open, none)!
    expect(p.rows.map((r) => r.id)).toEqual(['2', '1'])
    expect(p.greyCount).toBe(2)
    expect(p.greyContractUsd).toBe(400_000)
    expect(p.line).toBe('2 open jobs have no %. $400k of contract reads as half done.')
    expect(p.done).toBe(false)
    expect(p.rows[0]).toMatchObject({ label: 'J2 · Job 2', contractUsd: 280_000, setPct: null, status: 'no %' })
    expect(p.rows[0]!.modalJob).toEqual({ id: '2', hcpNumber: 'J2', jobName: 'Job 2', label: 'J2 · Job 2' })
    expect(buildPctPrompt([job('9', 45_000, null)], none)!.line).toBe('1 open job has no %. $45k of contract reads as half done.')
  })

  it('counts the same jobs the Build card draws grey', () => {
    const input: BuildPaceInput = { windowStart: '2026-08-16', todayYmd: '2026-10-11', openJobs: open, jobsByPoint: new Map(open.map((j) => [j.id, j])), points: [], createdInWindow: [] }
    expect(buildPctPrompt(open, none)!.greyCount).toBe(buildBuildPace(input).pile.guessJobs)
    expect(open.filter(isGreyJob).map((j) => j.id)).toEqual(['1', '2'])
  })

  it('keeps a job set this visit at the bottom, marked set, and reads done when none is left', () => {
    const afterOne = buildPctPrompt([job('1', 120_000, null), job('2', 280_000, 60)], new Map([['2', 60]]))!
    expect(afterOne.rows.map((r) => [r.id, r.status])).toEqual([
      ['1', 'no %'],
      ['2', '60% · set'],
    ])
    expect(afterOne.rows[1]!.setPct).toBe(60)
    expect(afterOne.line).toBe('1 open job has no %. $120k of contract reads as half done.')
    const afterAll = buildPctPrompt([job('1', 120_000, 25), job('2', 280_000, 60)], new Map([['1', 25], ['2', 60]]))!
    expect(afterAll.done).toBe(true)
    expect(afterAll.greyCount).toBe(0)
    expect(afterAll.line).toBe(PCT_PROMPT_DONE_LINE)
    expect(afterAll.rows.map((r) => r.id)).toEqual(['2', '1'])
  })

  it('shows nothing when no job is grey and nothing was set', () => {
    expect(buildPctPrompt([job('3', 90_000, 40)], none)).toBeNull()
    expect(buildPctPrompt([], none)).toBeNull()
  })

  it('names a job with no number by its name for the modal', () => {
    const p = buildPctPrompt([job('7', 50_000, null, { hcpNumber: '', label: 'Smith remodel', jobName: 'Smith remodel' })], none)!
    expect(p.rows[0]!.modalJob).toEqual({ id: '7', hcpNumber: 'Smith remodel', jobName: 'Smith remodel', label: 'Smith remodel' })
  })

  it('keeps its lines in plain words', () => {
    for (const line of [buildPctPrompt(open, none)!.line, buildPctPrompt([job('9', 45_000, null)], none)!.line, PCT_PROMPT_DONE_LINE]) {
      expect(plainWordsFailures(line), line).toEqual([])
    }
  })
})

describe('withPctSet', () => {
  const base = (): BuildPaceInput => {
    const jobs = [job('1', 120_000, null), job('2', 200_000, 50), job('3', 80_000, null, { createdYmd: '2026-09-01' })]
    return { windowStart: '2026-08-16', todayYmd: '2026-10-11', openJobs: jobs, jobsByPoint: new Map(jobs.map((j) => [j.id, j])), points: [{ jobId: '2', atYmd: '2026-07-01', pct: 30, source: 'hand' }, { jobId: '2', atYmd: '2026-09-15', pct: 50, source: 'hand' }], createdInWindow: [] }
  }

  it('shrinks the grey and grows the known pile, with nothing built for an old job', () => {
    const before = base()
    const after = withPctSet(before, '1', 60)
    const a = buildBuildPace(before)
    const b = buildBuildPace(after)
    expect(a.pile.guessJobs).toBe(2)
    expect(b.pile.guessJobs).toBe(1)
    expect(b.pile.knownJobs).toBe(a.pile.knownJobs + 1)
    expect(b.pile.knownUsd).toBeCloseTo(a.pile.knownUsd + 120_000 * 0.4, 6)
    expect(b.pile.guessUsd).toBeCloseTo(a.pile.guessUsd - 120_000 * 0.5, 6)
    expect(b.builtUsd).toBeCloseTo(a.builtUsd, 6)
    expect(after.points[after.points.length - 1]).toEqual({ jobId: '1', atYmd: '2026-10-11', pct: 60, source: 'hand' })
    expect(after.jobsByPoint.get('1')!.pctComplete).toBe(60)
  })

  it('counts a job created in the window as built to its new percent, the way a reload reads it', () => {
    const b = buildBuildPace(withPctSet(base(), '3', 25))
    expect(b.builtUsd - buildBuildPace(base()).builtUsd).toBeCloseTo(80_000 * 0.25, 6)
  })

  it('leaves the reads it was given untouched, and ignores a job it does not know', () => {
    const before = base()
    withPctSet(before, '1', 60)
    expect(before.openJobs[0]!.pctComplete).toBeNull()
    expect(before.points).toHaveLength(2)
    expect(withPctSet(before, 'nope', 60)).toBe(before)
    expect(withPctSet(before, '1', 140).openJobs[0]!.pctComplete).toBe(100)
  })
})
