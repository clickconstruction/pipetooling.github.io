// @vitest-environment jsdom
// (localStorage-backed persistence helpers; the global vitest environment is node)
import { beforeEach, describe, expect, it } from 'vitest'
import {
  EMPTY_STAGES_EXCLUDE_FILTERS,
  STAGES_EXCLUDE_NONE,
  countStagesExclusions,
  filterJobsByExclusions,
  loadStagesExcludeFilters,
  saveStagesExcludeFilters,
  stagesExcludeOptionsFromJobs,
  toggleStagesExclusion,
  type StagesExcludeFilters,
} from './jobsStagesExcludeFilters'
import type { JobWithDetails } from '../types/jobWithDetails'

function job(over: Partial<JobWithDetails>): JobWithDetails {
  return { id: Math.random().toString(36).slice(2), ...over } as JobWithDetails
}

const gunDog = { id: 'dev-1', name: 'Gun Dog' }
const ranch = { id: 'dev-2', name: 'Jacob Roberts Ranch' }
const heron = { id: 'gc-1', name: 'Heron Construction Group' }
const doneRight = { id: 'gc-2', name: 'Done Right Foundation' }
const trace = { account_manager_user_id: 'u-trace', account_manager: { id: 'u-trace', name: 'Trace' }, account_manager_relationship: 'only' }

const JOBS: JobWithDetails[] = [
  job({ development: gunDog, ...trace }),
  job({ development: gunDog, ...trace }),
  job({ development: ranch, gcCustomer: doneRight }),
  job({ gcCustomer: heron, account_manager_user_id: 'u-mal', account_manager: { id: 'u-mal', name: 'Malachi' }, account_manager_relationship: 'primary' }),
  job({ gcCustomer: heron }),
  job({}),
]

function filters(over: Partial<StagesExcludeFilters>): StagesExcludeFilters {
  return { ...EMPTY_STAGES_EXCLUDE_FILTERS, ...over }
}

describe('stagesExcludeOptionsFromJobs', () => {
  it('lists distinct values with counts, name-sorted, none-row last', () => {
    const opts = stagesExcludeOptionsFromJobs(JOBS, EMPTY_STAGES_EXCLUDE_FILTERS)
    expect(opts.development.map((o) => [o.id, o.count])).toEqual([
      ['dev-1', 2],
      ['dev-2', 1],
      [STAGES_EXCLUDE_NONE, 3],
    ])
    expect(opts.gc.map((o) => [o.name, o.count])).toEqual([
      ['Done Right Foundation', 1],
      ['Heron Construction Group', 2],
      ['No GC set', 3],
    ])
    expect(opts.accountMan.map((o) => [o.name, o.count])).toEqual([
      ['Malachi', 1],
      ['Trace', 2],
      ['No Account Man', 3],
    ])
  })

  it('keeps an excluded id visible even when its jobs are gone', () => {
    const opts = stagesExcludeOptionsFromJobs(JOBS, filters({ gc: ['gc-vanished'] }))
    const ghost = opts.gc.find((o) => o.id === 'gc-vanished')
    expect(ghost).toEqual({ id: 'gc-vanished', name: '(no longer on the board)', count: 0 })
  })

  it('omits the none-row when every job has a value and none is not excluded', () => {
    const all = JOBS.filter((j) => j.development?.id)
    const opts = stagesExcludeOptionsFromJobs(all, EMPTY_STAGES_EXCLUDE_FILTERS)
    expect(opts.development.some((o) => o.id === STAGES_EXCLUDE_NONE)).toBe(false)
  })
})

describe('filterJobsByExclusions', () => {
  it('returns the same array when nothing is excluded', () => {
    expect(filterJobsByExclusions(JOBS, EMPTY_STAGES_EXCLUDE_FILTERS)).toBe(JOBS)
  })

  it('hides one development', () => {
    const out = filterJobsByExclusions(JOBS, filters({ development: ['dev-1'] }))
    expect(out).toHaveLength(4)
    expect(out.every((j) => j.development?.id !== 'dev-1')).toBe(true)
  })

  it('hides the untagged jobs via the none pseudo-value', () => {
    const out = filterJobsByExclusions(JOBS, filters({ accountMan: [STAGES_EXCLUDE_NONE] }))
    expect(out).toHaveLength(3)
    expect(out.every((j) => j.account_manager_user_id)).toBe(true)
  })

  it('composes across dimensions (AND of per-dimension exclusions)', () => {
    const out = filterJobsByExclusions(
      JOBS,
      filters({ development: ['dev-1'], gc: ['gc-1'], accountMan: [STAGES_EXCLUDE_NONE] }),
    )
    // dev-1 jobs gone, gc-1 jobs gone, AM-less jobs gone → only the ranch/doneRight job... which has no AM → gone too.
    expect(out).toHaveLength(0)
  })
})

describe('toggleStagesExclusion / countStagesExclusions', () => {
  it('adds then removes without mutating', () => {
    const a = toggleStagesExclusion(EMPTY_STAGES_EXCLUDE_FILTERS, 'gc', 'gc-1')
    expect(a.gc).toEqual(['gc-1'])
    expect(EMPTY_STAGES_EXCLUDE_FILTERS.gc).toEqual([])
    expect(countStagesExclusions(a)).toBe(1)
    const b = toggleStagesExclusion(a, 'gc', 'gc-1')
    expect(b.gc).toEqual([])
    expect(countStagesExclusions(b)).toBe(0)
  })
})

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips and clears the key at zero exclusions', () => {
    const f = filters({ development: ['dev-1'], accountMan: [STAGES_EXCLUDE_NONE] })
    saveStagesExcludeFilters(f)
    expect(loadStagesExcludeFilters()).toEqual(f)
    saveStagesExcludeFilters(EMPTY_STAGES_EXCLUDE_FILTERS)
    expect(localStorage.getItem('jobs-stages-exclude-filters')).toBeNull()
    expect(loadStagesExcludeFilters()).toEqual(EMPTY_STAGES_EXCLUDE_FILTERS)
  })

  it('degrades malformed storage to no exclusions', () => {
    localStorage.setItem('jobs-stages-exclude-filters', '{"gc": "not-an-array", "development": [3], "junk": true')
    expect(loadStagesExcludeFilters()).toEqual(EMPTY_STAGES_EXCLUDE_FILTERS)
    localStorage.setItem('jobs-stages-exclude-filters', JSON.stringify({ gc: 'nope', development: [3, 'dev-2', ''], accountMan: null }))
    expect(loadStagesExcludeFilters()).toEqual(filters({ development: ['dev-2'] }))
  })
})
