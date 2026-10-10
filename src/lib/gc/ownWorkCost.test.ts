/**
 * GC mode, Owner Billing's O11: our own work's Pipeline jobs (`ownWorkCost.ts`). A job's spend is the Costs tab's own
 * sum; general conditions count at their budget until the spend passes it, then at the spend, and at their cost once
 * the job closes; without pay access, or before the read, at their budget; and the words say which.
 */
import { describe, expect, it } from 'vitest'
import { plainWordsFailures } from '../plainWords'
import { crewCloseoutWords, crewCost, crewCostWords, generalConditionsCost, generalConditionsWords, holderWords, ownWorkHolders, ownWorkJobCost, ownWorkJobIds, type OwnWorkCosts } from './ownWorkCost'
import { JOB_BURN_EARLY_FIELD_DAYS, JOB_BURN_EARLY_PCT } from '../jobs/jobBurn'
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

  it('and each crew trade’s job, once (O11a)', () => {
    expect(ownWorkJobIds([{ generalConditionsJobId: 'a' }], { k1: 'c1', k2: 'c2', k3: 'a' })).toEqual(['a', 'c1', 'c2'])
  })
})

describe('our own crew’s cost (O11a)', () => {
  const crewJob = { ...ownWorkJobCost({ id: 'j-crew', label: 'J 1071', name: 'Oak Ridge plumbing', status: 'working' }, []), spentUsd: 10_400, fieldDays: 20 }
  const own = (over: Partial<typeof crewJob> = {}, payAccess = true): OwnWorkCosts => ({ payAccess, crewJobs: { k3: 'j-crew' }, byJob: { 'j-crew': { ...crewJob, ...over } } })
  const pkg = (pctDone?: number) => ({ id: 'k3', selfPerform: { ref: 'B7', value: 26_000, note: '', ...(pctDone === undefined ? {} : { pctDone }) } })

  it('at today’s pace once the Pipeline says it is not too early: spent ÷ percent done', () => {
    expect(crewCost(pkg(40), 26_000, own())).toMatchObject({ state: 'pace', spent: 10_400, counted: 26_000, jobLabel: 'J 1071' })
    expect(crewCost(pkg(50), 26_000, own()).counted).toBe(20_800)
  })

  it('too early under the Pipeline’s own percent and field days, or with no percent: at its price', () => {
    expect([JOB_BURN_EARLY_PCT, JOB_BURN_EARLY_FIELD_DAYS]).toEqual([10, 3])
    expect(crewCost(pkg(JOB_BURN_EARLY_PCT - 1), 26_000, own())).toMatchObject({ state: 'early', counted: 26_000, spent: 10_400 })
    expect(crewCost(pkg(JOB_BURN_EARLY_PCT), 26_000, own()).state).toBe('pace')
    expect(crewCost(pkg(40), 26_000, own({ fieldDays: JOB_BURN_EARLY_FIELD_DAYS - 1 })).state).toBe('early')
    expect(crewCost(pkg(), 26_000, own()).state).toBe('early')
  })

  it('done at 100%, or with its Pipeline job billed or paid: what it cost', () => {
    expect(crewCost(pkg(100), 26_000, own({ spentUsd: 24_300 }))).toMatchObject({ state: 'done', counted: 24_300 })
    expect(crewCost(pkg(70), 26_000, own({ spentUsd: 24_300, finished: true }))).toMatchObject({ state: 'done', counted: 24_300 })
  })

  it('at its price with no job linked, without pay access, before the read, when it failed, or when another place counts it', () => {
    expect(crewCost(pkg(40), 26_000, { payAccess: true, byJob: {} }).state).toBe('none')
    expect(crewCost(pkg(40), 26_000, own({}, false))).toMatchObject({ state: 'hidden', counted: 26_000, spent: null })
    expect(crewCost(pkg(40), 26_000, undefined).state).toBe('none')
    expect(crewCost(pkg(40), 26_000, { payAccess: true, crewJobs: { k3: 'j-crew' }, byJob: {} }).state).toBe('loading')
    expect(crewCost(pkg(40), 26_000, { payAccess: true, crewJobs: { k3: 'j-crew' }, byJob: { 'j-crew': 'error' } }).state).toBe('error')
    expect(crewCost(pkg(40), 26_000, own(), 'Electrical')).toMatchObject({ state: 'shared', sharedWith: 'Electrical', counted: 26_000 })
  })

  it('reads in words, on Money and on Closeout', () => {
    expect(crewCostWords(crewCost(pkg(40), 26_000, own()))).toBe("our own crew · signed for $26,000, about $26,000 at today's pace on Pipeline job J 1071 · $10,400 spent, 40% done")
    expect(crewCostWords(crewCost(pkg(5), 26_000, own({ spentUsd: 1_200 })))).toBe('our own crew · signed for $26,000 · $1,200 spent so far on Pipeline job J 1071, too early to say what it will cost')
    expect(crewCostWords(crewCost(pkg(100), 26_000, own({ spentUsd: 24_300 })))).toBe('our own crew · signed for $26,000, cost $24,300 on Pipeline job J 1071')
    expect(crewCostWords(crewCost(pkg(40), 26_000, own({}, false)))).toBe('our own crew · signed for $26,000, at its price: its labor cost is for those who see pay')
    expect(crewCostWords(crewCost(pkg(40), 26_000, { payAccess: true, byJob: {} }))).toBe('our own crew · signed for $26,000, at its price: it has no Pipeline job yet')
    expect(crewCloseoutWords(crewCost(pkg(100), 26_000, own({ spentUsd: 24_300 })))).toBe('It cost $24,300 on Pipeline job J 1071, against $26,000 signed.')
    expect(crewCloseoutWords(crewCost(pkg(40), 26_000, { payAccess: true, byJob: {} }))).toBeNull()
  })

  it('Closeout’s crew sentences are plain words', () => {
    const said = [
      crewCost(pkg(100), 26_000, own({ spentUsd: 24_300 })),
      crewCost(pkg(50), 26_000, own()),
      crewCost(pkg(5), 26_000, own({ spentUsd: 1_200 })),
      crewCost(pkg(40), 26_000, own({}, false)),
    ].map(crewCloseoutWords)
    for (const words of said) expect(plainWordsFailures(words ?? ''), String(words)).toEqual([])
  })
})

describe('a Pipeline job counts once (O11a)', () => {
  const projects = [
    { id: 'p1', name: 'Oak Ridge', generalConditionsJobId: 'j-gc', packages: [{ id: 'k3', trade: 'Plumbing', selfPerform: { ref: '', value: 0, note: '' } }, { id: 'k4', trade: 'Electrical', selfPerform: { ref: '', value: 0, note: '' } }] },
    { id: 'p2', name: 'Stone Oak', generalConditionsJobId: null, packages: [{ id: 's3', trade: 'Plumbing', selfPerform: { ref: '', value: 0, note: '' } }] },
  ] as never
  const own: OwnWorkCosts = { payAccess: true, crewJobs: { k3: 'j-1', k4: 'j-1', s3: 'j-gc' }, byJob: {} }

  it('in the first place that holds it: crews before general conditions, project by project', () => {
    const holders = ownWorkHolders(projects, own)
    expect(holders.get('j-1')).toEqual({ key: 'k3', projectId: 'p1', words: 'Plumbing' })
    expect(holders.get('j-gc')).toEqual({ key: 'general-conditions:p1', projectId: 'p1', words: 'general conditions' })
    expect(holderWords(holders.get('j-gc'), 'p2', projects)).toBe('general conditions at Oak Ridge')
    expect(holderWords(holders.get('j-1'), 'p1', projects)).toBe('Plumbing')
  })
})
