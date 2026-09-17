import { describe, expect, it } from 'vitest'
import type { StageRow } from '../jobsStagesBoard'
import { stagesUnifiedRowKey } from './stagesUnifiedRowKey'

const job = { id: 'j1' } as StageRow extends { job: infer J } ? J : never
const inv = { id: 'i9' } as Extract<StageRow, { kind: 'invoice' }>['inv']

describe('stagesUnifiedRowKey', () => {
  it('keeps the keys the table used before the row split', () => {
    expect(stagesUnifiedRowKey({ kind: 'job', job })).toBe('job-j1')
    expect(stagesUnifiedRowKey({ kind: 'job_with_merged_billed', job, inv })).toBe('job-j1-billed-i9')
    expect(stagesUnifiedRowKey({ kind: 'job_with_primary_rtb', job, inv })).toBe('job-j1-rtb-i9')
    expect(stagesUnifiedRowKey({ kind: 'invoice', job, inv })).toBe('inv-i9')
  })
})
