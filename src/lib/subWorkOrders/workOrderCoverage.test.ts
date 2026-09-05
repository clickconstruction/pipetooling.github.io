import { describe, expect, it } from 'vitest'
import { buildJobWorkOrderCoverage, workOrderBoardBucket, workOrderChipLabel, type WorkOrderRowLike } from './workOrderCoverage'

const TODAY = '2026-09-05'
const row = (over: Partial<WorkOrderRowLike> & { id: string; status: string }): WorkOrderRowLike => ({
  amount: 100,
  display_name: 'Behar Kraja',
  job_id: 'job-1',
  labor_job_id: null,
  step_id: null,
  record_id: null,
  offered_at: null,
  offer_expires_at: null,
  signed_at: null,
  accepted_at: null,
  declined_at: null,
  decline_reason: null,
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})

describe('buildJobWorkOrderCoverage', () => {
  it('signed beats sent beats draft beats declined; cancelled is invisible', () => {
    const rows = [
      row({ id: 'd', status: 'declined', decline_reason: 'too soon' }),
      row({ id: 'x', status: 'cancelled' }),
      row({ id: 'o', status: 'offered', offered_at: '2026-09-04T10:00:00Z', offer_expires_at: '2026-09-11' }),
      row({ id: 'a', status: 'accepted', signed_at: '2026-09-05T10:00:00Z', record_id: 'WO-977-01', labor_job_id: 'sheet-1' }),
    ]
    const c = buildJobWorkOrderCoverage(rows, TODAY)
    expect(c.kind).toBe('signed')
    if (c.kind === 'signed') {
      expect(c.signedOn).toBe('2026-09-05')
      expect(c.recordId).toBe('WO-977-01')
      expect(c.laborJobId).toBe('sheet-1')
    }
    expect(buildJobWorkOrderCoverage([row({ id: 'x', status: 'cancelled' })], TODAY)).toEqual({ kind: 'none' })
    expect(buildJobWorkOrderCoverage([rows[0]!, rows[2]!], TODAY).kind).toBe('sent')
  })
  it('flags unpriced drafts and expired offers', () => {
    const draft = buildJobWorkOrderCoverage([row({ id: 'd', status: 'draft', amount: null })], TODAY)
    expect(draft).toEqual({ kind: 'draft', id: 'd', subName: 'Behar Kraja', unpriced: true })
    expect(workOrderChipLabel(draft)).toBe('Drafted · no price yet')
    const expired = buildJobWorkOrderCoverage([row({ id: 'o', status: 'offered', offer_expires_at: '2026-09-01' })], TODAY)
    expect(expired.kind === 'sent' && expired.expired).toBe(true)
    expect(workOrderChipLabel(expired)).toBe('Offer expired')
    expect(workOrderBoardBucket(row({ id: 'o', status: 'offered', offer_expires_at: '2026-09-01' }), TODAY)).toBe('expired')
    expect(workOrderBoardBucket(row({ id: 'o2', status: 'offered' }), TODAY)).toBe('awaiting')
    expect(workOrderBoardBucket(row({ id: 'x', status: 'cancelled' }), TODAY)).toBeNull()
  })
})
