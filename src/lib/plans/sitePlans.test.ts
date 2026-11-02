import { describe, expect, it } from 'vitest'
import type { PlanPartRow, PlanSetRow } from './planSets'
import { buildSitePlansView, jobNeedsNoPlans, olderSetsFor, orderForPicking, sitePlansAskCount, sitePlansChipWords, sitePlansCountWords, sitePlansLeftOutWords, sitePlansNeedWords } from './sitePlans'

function part(over: Partial<PlanPartRow> & { id: string; name: string }): PlanPartRow {
  return { development_id: 'd1', job_id: null, position: 0, current_set_id: null, current_set_by: null, current_set_at: null, created_by: null, created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', ...over }
}
function set(over: Partial<PlanSetRow> & { id: string; part_id: string }): PlanSetRow {
  return {
    name: 'Issued set', kind: 'issued', source: 'gc', dated: null, came_at: '2026-10-01T12:00:00Z', memo: '', link: 'https://drive.google.com/x',
    replaces_set_id: null, marks_up_set_id: null, job_id: null, file_name: null, file_size: null, file_count: null, checked_at: null, check_note: null,
    created_by: null, created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', ...over,
  }
}

const bunker = part({ id: 'p1', name: 'Bunker', position: 2, current_set_id: 's2', current_set_at: '2026-10-30T00:00:00Z' })
const lodge = part({ id: 'p2', name: 'Lodge', position: 1, current_set_id: 's3' })
const atv = part({ id: 'p3', name: 'ATV building', position: 3 })
const sets = [
  set({ id: 's1', part_id: 'p1', name: 'Bunker issued set', dated: '2026-08-11' }),
  set({ id: 's2', part_id: 'p1', name: 'Bunker addendum 1', kind: 'addendum', dated: '2026-10-02', replaces_set_id: 's1' }),
  set({ id: 's3', part_id: 'p2', name: 'Lodge issued set', dated: '2026-08-11' }),
  set({ id: 's4', part_id: 'p1', name: 'As-built · JP991', kind: 'as_built', source: 'ours', job_id: 'j1', marks_up_set_id: 's2', came_at: '2026-11-01T00:00:00Z' }),
]
const jobs = [
  { id: 'j1', label: 'JP991', plan_part_id: 'p1' },
  { id: 'j2', label: 'JP953', plan_part_id: 'p1' },
  { id: 'j3', label: 'JP956', plan_part_id: 'p2' },
  { id: 'j4', label: 'JP957', plan_part_id: null },
  { id: 'j5', label: 'JP958', plan_part_id: 'gone' },
  // on no part, but they need no plans: a billing holder, the office's own service call, and an HCP job with nothing else behind it
  { id: 'j6', label: 'JP543', plan_part_id: null, billing_only: true },
  { id: 'j7', label: 'JP933', plan_part_id: null, kind: 'service' },
  { id: 'j8', label: 'HCP 7', plan_part_id: null, hcp_number: '7', click_number: null, bid_id: null, revenue: null, status: 'working' },
]
const bids = [
  { id: 'b1', label: 'BP340', plans_link: 'https://drive.google.com/file/d/robot/view' },
  { id: 'b2', label: 'BP198', plans_link: null },
]

describe('buildSitePlansView', () => {
  const v = buildSitePlansView({ parts: [bunker, lodge, atv], sets, jobs, bids })

  it('orders the parts by position and gives each its current set, the replaced one, the older ones, the as-builts and its jobs', () => {
    expect(v.parts.map((r) => r.part.name)).toEqual(['Lodge', 'Bunker', 'ATV building'])
    const b = v.parts[1]!
    expect(b.current?.id).toBe('s2')
    expect(b.replaced?.id).toBe('s1')
    expect(olderSetsFor(b).map((s) => s.id)).toEqual(['s1'])
    expect(b.asBuilts.map((s) => s.id)).toEqual(['s4'])
    expect(b.jobs.map((j) => j.label)).toEqual(['JP991', 'JP953'])
  })

  it('lists the jobs that build from plans and name no part, counting a part that no longer exists as none, and the parts with no set', () => {
    expect(v.jobsWithNoPart.map((j) => j.label)).toEqual(['JP957', 'JP958'])
    expect(v.partsWithNoSet.map((r) => r.part.name)).toEqual(['ATV building'])
    expect(v.setCount).toBe(4)
    expect(v.bidsPinned).toEqual([{ kind: 'bid', id: 'b1', label: 'BP340', link: 'https://drive.google.com/file/d/robot/view' }])
  })

  it('leaves a billing-only job and a service call out of the count, each with its reason, and says so in one quiet line', () => {
    expect(v.jobsNeedingNoPlans).toEqual([
      { kind: 'job', id: 'j6', label: 'JP543', why: 'billing_only' },
      { kind: 'job', id: 'j7', label: 'JP933', why: 'service' },
      { kind: 'job', id: 'j8', label: 'HCP 7', why: 'service' },
    ])
    expect(sitePlansLeftOutWords(v)).toBe('3 jobs need no plans: 1 bills only, 2 are service calls')
    expect(sitePlansLeftOutWords(buildSitePlansView({ parts: [bunker], sets, jobs: [jobs[6]!], bids: [] }))).toBe('1 job needs no plans: 1 is a service call')
    expect(sitePlansLeftOutWords(buildSitePlansView({ parts: [bunker], sets, jobs: [jobs[5]!, { id: 'j9', label: 'JP544', plan_part_id: null, billing_only: true }], bids: [] }))).toBe('2 jobs need no plans: 2 bill only')
    expect(sitePlansLeftOutWords(buildSitePlansView({ parts: [bunker], sets, jobs: jobs.slice(0, 5), bids: [] }))).toBeNull()
  })

  it('reads why a job needs no plans: bills only first, then the kind kernel; a job of no known kind still counts', () => {
    expect(jobNeedsNoPlans({ billing_only: true, kind: 'project' })).toBe('billing_only')
    expect(jobNeedsNoPlans({ kind: 'service' })).toBe('service')
    expect(jobNeedsNoPlans({ kind: 'project', hcp_number: '7' })).toBeNull()
    expect(jobNeedsNoPlans({ hcp_number: '7', click_number: null, bid_id: null, revenue: null, status: 'working' })).toBe('service')
    expect(jobNeedsNoPlans({ click_number: '957', bid_id: 'b1' })).toBeNull()
    expect(jobNeedsNoPlans({})).toBeNull()
  })

  it('writes the strip and the chips', () => {
    expect(sitePlansCountWords(v)).toBe('4 sets on 3 parts')
    expect(sitePlansNeedWords(v)).toBe('1 part with no set · 2 jobs follow no plans yet')
    expect(sitePlansChipWords(v)).toEqual({ noSet: '1 part with no set', noPart: '2 jobs follow no plans yet', allGood: null })
    expect(sitePlansAskCount(v)).toBe(3)
    const one = buildSitePlansView({ parts: [bunker], sets, jobs: [jobs[3]!], bids: [] })
    expect(sitePlansChipWords(one).noPart).toBe('1 job follows no plans yet')
  })

  it('reads clean when every job names a part with a set, and says no part yet with none', () => {
    const clean = buildSitePlansView({ parts: [bunker], sets, jobs: [jobs[0]!, jobs[5]!], bids: [] })
    expect(sitePlansNeedWords(clean)).toBeNull()
    expect(sitePlansChipWords(clean).allGood).toBe('every job that builds from plans names a part with a set')
    expect(sitePlansLeftOutWords(clean)).toBe('1 job needs no plans: 1 bills only')
    const empty = buildSitePlansView({ parts: [], sets: [], jobs, bids })
    expect(sitePlansCountWords(empty)).toBe('no part yet')
    expect(sitePlansNeedWords(empty)).toBe('5 jobs follow no plans yet')
    expect(sitePlansChipWords(empty).allGood).toBeNull()
  })
})

describe('orderForPicking', () => {
  it('sorts the jobs on no part by name, the nameless last, ties by number', () => {
    const rows = [
      { kind: 'job' as const, id: 'a', label: 'JP957', name: null },
      { kind: 'job' as const, id: 'b', label: 'JP955', name: 'Bunker BESS room HVAC' },
      { kind: 'job' as const, id: 'c', label: 'JP765', name: 'ATV building fans' },
      { kind: 'job' as const, id: 'd', label: 'JP956', name: 'ATV building gas line' },
      { kind: 'job' as const, id: 'e', label: 'JP424', name: 'Diamondback' },
      { kind: 'job' as const, id: 'f', label: 'JP423', name: 'Diamondback' },
    ]
    expect(orderForPicking(rows).map((r) => r.id)).toEqual(['c', 'd', 'b', 'f', 'e', 'a'])
  })
  it('carries the name onto the carriers', () => {
    const v = buildSitePlansView({ parts: [], sets: [], jobs: [{ id: 'j', label: 'JP1', name: 'Gas line' }], bids: [] })
    expect(v.jobsWithNoPart[0]?.name).toBe('Gas line')
  })
})
