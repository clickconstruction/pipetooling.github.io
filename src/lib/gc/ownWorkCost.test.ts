/**
 * GC mode, Owner Billing's O11: our own work's Pipeline jobs (`ownWorkCost.ts`). A job's spend is the Costs tab's own
 * sum; general conditions count at their budget until the spend passes it, then at the spend, and at their cost once
 * the job closes; without pay access, or before the read, at their budget; and the words say which.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { generalConditionsCost, generalConditionsWords, ownWorkJobCost, ownWorkJobIds, type OwnWorkCosts } from './ownWorkCost'
import type { GcProject } from './types'

const job = { id: 'j-gc', label: 'J 1080', name: 'Oak Ridge general conditions', status: 'working' }

describe('a Pipeline job’s spend', () => {
  it('adds up every source the Costs tab reads, and counts the days with team labor', () => {
    const cost = ownWorkJobCost(job, [
      { source: 'team_labor', amount: 1_200, dateKey: '2026-10-01' },
      { source: 'team_labor', amount: 800, dateKey: '2026-10-01' },
      { source: 'team_labor', amount: 900, dateKey: '2026-10-02' },
      { source: 'sub_labor', amount: 2_000, dateKey: '2026-10-03' },
      { source: 'mercury_card', amount: 450, dateKey: '2026-10-03' },
      { source: 'supply_house', amount: 300, dateKey: '2026-10-04' },
    ])
    expect(cost).toEqual({ jobId: 'j-gc', label: 'J 1080', name: 'Oak Ridge general conditions', spentUsd: 5_650, teamUsd: 2_900, subUsd: 2_000, partsUsd: 750, fieldDays: 2, finished: false })
  })

  it('a billed or paid job is finished', () => {
    expect(ownWorkJobCost({ ...job, status: 'billed' }, []).finished).toBe(true)
    expect(ownWorkJobCost({ ...job, status: 'paid' }, []).finished).toBe(true)
    expect(ownWorkJobCost({ ...job, status: 'working' }, []).spentUsd).toBe(0)
  })
})

describe('general conditions’ cost', () => {
  const read = (spentUsd: number, payAccess = true): OwnWorkCosts => ({ payAccess, byJob: { 'j-gc': { ...ownWorkJobCost(job, []), spentUsd } } })
  const building: Pick<GcProject, 'generalConditions' | 'generalConditionsJobId' | 'closedOn'> = { generalConditions: 138_000, generalConditionsJobId: 'j-gc', closedOn: null }

  it('at their budget until the spend passes it, then at the spend', () => {
    expect(generalConditionsCost(building, read(61_200))).toMatchObject({ state: 'running', spent: 61_200, counted: 138_000, jobLabel: 'J 1080' })
    expect(generalConditionsCost(building, read(142_300))).toMatchObject({ state: 'running', spent: 142_300, counted: 142_300 })
  })

  it('at what they cost once the job closes, a saving too', () => {
    expect(generalConditionsCost({ ...building, closedOn: '2026-11-20' }, read(131_500))).toMatchObject({ state: 'closed', spent: 131_500, counted: 131_500 })
  })

  it('at their budget with no job named, without pay access, before the read and when it failed', () => {
    expect(generalConditionsCost({ ...building, generalConditionsJobId: null }, read(1)).state).toBe('none')
    expect(generalConditionsCost(building, read(999_999, false))).toMatchObject({ state: 'hidden', counted: 138_000, spent: null })
    expect(generalConditionsCost(building, undefined).state).toBe('loading')
    expect(generalConditionsCost(building, { payAccess: true, byJob: {} }).state).toBe('loading')
    expect(generalConditionsCost(building, { payAccess: true, byJob: { 'j-gc': 'error' } })).toMatchObject({ state: 'error', counted: 138_000 })
  })

  it('reads in words, the same on Money and on Closeout', () => {
    const words = (spent: number, over: Partial<typeof building> = {}, payAccess = true) => generalConditionsWords(generalConditionsCost({ ...building, ...over }, read(spent, payAccess)))
    expect(words(61_200)).toBe('General conditions $138,000: $61,200 spent so far on Pipeline job J 1080.')
    expect(words(142_300)).toBe('General conditions $138,000: $142,300 spent so far on Pipeline job J 1080, $4,300 over their budget.')
    expect(words(131_500, { closedOn: '2026-11-20' })).toBe('General conditions cost $131,500 of their $138,000 budget on Pipeline job J 1080.')
    expect(words(1, { generalConditionsJobId: null })).toBe('General conditions $138,000, at their budget: no Pipeline job is named for them yet.')
    expect(words(1, {}, false)).toBe('General conditions $138,000, at their budget: their labor cost is for those who see pay.')
    expect(generalConditionsWords(generalConditionsCost(building, undefined))).toBe("General conditions $138,000, at their budget until their Pipeline job's spend is read.")
    expect(generalConditionsWords(generalConditionsCost(building, { payAccess: true, byJob: { 'j-gc': 'error' } }))).toBe("General conditions $138,000, at their budget: their Pipeline job's spend did not load.")
  })

  it('reads in plain words, every one', () => {
    const all = [
      generalConditionsCost(building, read(61_200)),
      generalConditionsCost(building, read(142_300)),
      generalConditionsCost({ ...building, closedOn: '2026-11-20' }, read(131_500)),
      generalConditionsCost({ ...building, generalConditionsJobId: null }, read(1)),
      generalConditionsCost(building, read(1, false)),
      generalConditionsCost(building, undefined),
      generalConditionsCost(building, { payAccess: true, byJob: { 'j-gc': 'error' } }),
    ].map(generalConditionsWords)
    for (const words of all) expect(plainWordsFailures(words), words).toEqual([])
  })
})

describe('the jobs to read', () => {
  it('each general conditions job once, none for a project with none named', () => {
    expect(ownWorkJobIds([{ generalConditionsJobId: 'a' }, { generalConditionsJobId: null }, { generalConditionsJobId: 'a' }, {}, { generalConditionsJobId: 'b' }])).toEqual(['a', 'b'])
  })
})
