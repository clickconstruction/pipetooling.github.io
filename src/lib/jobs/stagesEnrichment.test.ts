import { describe, expect, it } from 'vitest'
import { applyStagesEnrichment, EMPTY_STAGES_ENRICHMENT, patchJobsById } from './stagesEnrichment'
import type { JobWithDetails } from '../../types/jobWithDetails'

const job = (id: string, o: Partial<JobWithDetails> = {}): JobWithDetails => ({ id, status: 'working', materials: [], fixtures: [], payments: [], invoices: [], team_members: [], ...o }) as unknown as JobWithDetails

describe('applyStagesEnrichment', () => {
  it('lays the four fields on every row, sorted, with the banner picked; uncovered rows read empty', () => {
    const out = applyStagesEnrichment([job('a'), job('b')], {
      materialsByJobId: new Map([['a', [{ id: 'm2', job_id: 'a', sequence_order: 2 }, { id: 'm1', job_id: 'a', sequence_order: 1 }] as never]]),
      fixturesByJobId: new Map([['a', [{ id: 'f1', job_id: 'a', sequence_order: 1 }] as never]]),
      scheduleMaxByJobId: new Map([['a', '2026-09-09']]),
      estimateCandidatesByJobId: new Map([['a', [{ estimate_number: 2, title: 'Accepted', status: 'customer_accepted', updated_at: '2026-09-01' }]]]),
    })
    expect(out[0]).toMatchObject({ id: 'a', materials: [{ id: 'm1' }, { id: 'm2' }], fixtures: [{ id: 'f1' }], last_schedule_work_date: '2026-09-09', linkedEstimateForStages: { estimate_number: 2 } })
    expect(out[1]).toMatchObject({ id: 'b', materials: [], fixtures: [], last_schedule_work_date: null, linkedEstimateForStages: null })
    expect(applyStagesEnrichment([job('a')], EMPTY_STAGES_ENRICHMENT)[0]).toMatchObject({ materials: [], last_schedule_work_date: null })
  })
})

describe('patchJobsById', () => {
  it('takes the enriched twin’s four fields only, keeps rows it did not cover, and never resurrects a row that left', () => {
    const prev = [job('a', { status: 'ready_to_bill' } as never), job('b')]
    const enriched = [job('a', { status: 'working', fixtures: [{ id: 'f1' }] as never, last_schedule_work_date: '2026-09-09' }), job('gone', { fixtures: [{ id: 'x' }] as never })]
    const out = patchJobsById(prev, enriched)
    expect(out.map((j) => j.id)).toEqual(['a', 'b'])
    expect(out[0]).toMatchObject({ status: 'ready_to_bill', fixtures: [{ id: 'f1' }], last_schedule_work_date: '2026-09-09', linkedEstimateForStages: null })
    expect(out[1]).toBe(prev[1])
  })
  it('an empty enrichment is a copy of the board', () => {
    const prev = [job('a')]
    const out = patchJobsById(prev, [])
    expect(out).toEqual(prev)
    expect(out).not.toBe(prev)
  })
})
