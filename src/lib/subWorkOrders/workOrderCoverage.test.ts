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

describe('an evening signature or offer keeps its day (v2.4469)', () => {
  it('reads the signed and sent days in the company calendar', () => {
    // 00:30 UTC on Oct 1 is 7:30 pm CDT on Sep 30; 00:30 UTC on Dec 2 is 6:30 pm CST on Dec 1.
    expect(buildJobWorkOrderCoverage([row({ id: 'a', status: 'accepted', signed_at: '2026-10-01T00:30:00Z' })], '2026-10-01')).toMatchObject({ kind: 'signed', signedOn: '2026-09-30' })
    expect(buildJobWorkOrderCoverage([row({ id: 'a', status: 'approved', accepted_at: '2026-12-02T00:30:00+00:00' })], '2026-12-02')).toMatchObject({ kind: 'signed', signedOn: '2026-12-01' })
    expect(buildJobWorkOrderCoverage([row({ id: 'o', status: 'offered', offered_at: '2026-09-05T00:30:00Z', offer_expires_at: '2026-09-11' })], TODAY)).toMatchObject({ kind: 'sent', sentAt: '2026-09-04' })
    expect(buildJobWorkOrderCoverage([row({ id: 'o', status: 'offered', offered_at: '2026-09-05T12:00:00Z' })], TODAY)).toMatchObject({ kind: 'sent', sentAt: '2026-09-05' })
  })
})
