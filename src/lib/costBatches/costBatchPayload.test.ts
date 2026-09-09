import { describe, expect, it } from 'vitest'
import {
  buildCostBatchPayload,
  summarizeCostBatchOps,
  validateCostBatchPayload,
  type CostBatchOp,
  type CostBatchPayload,
} from './costBatchPayload'

const TX = '11111111-1111-4111-8111-111111111111'
const JOB_A = '22222222-2222-4222-8222-222222222222'
const JOB_B = '33333333-3333-4333-8333-333333333333'
const INVOICE = '44444444-4444-4444-8444-444444444444'
const SESSION = '55555555-5555-4555-8555-555555555555'
const USER = '66666666-6666-4666-8666-666666666666'

const good: CostBatchOp[] = [
  {
    op: 'allocate',
    tx_id: TX,
    job_id: JOB_A,
    amount: 120.5,
    note: 'Trace ledger',
    from_job_id: JOB_B,
  },
  {
    op: 'supply_repoint',
    invoice_id: INVOICE,
    from_job_id: JOB_B,
    to_job_id: JOB_A,
  },
  { op: 'clock_repoint', session_id: SESSION, to_job_id: JOB_A },
  {
    op: 'other_charge',
    job_id: JOB_A,
    description: 'ESTIMATE — mobilization crews',
    amount: 22857.14,
  },
  { op: 'thread_note', job_id: JOB_A, body: 'moved per the ledger' },
]

const base: CostBatchPayload = {
  label: 'Trace ledger rev b',
  reason: 'book the ledger',
  author_user_id: USER,
  ops: good,
}

describe('validateCostBatchPayload', () => {
  it('accepts a well-formed batch of all five ops', () => {
    expect(validateCostBatchPayload(base)).toEqual([])
  })

  it('requires label, reason and at least one op', () => {
    expect(
      validateCostBatchPayload({ label: ' ', reason: '', ops: [] }),
    ).toEqual([
      'label is required',
      'reason is required',
      'ops must be a non-empty array',
    ])
  })

  it('rejects a non-positive allocation and a from_job equal to the target', () => {
    const p = {
      ...base,
      ops: [
        {
          op: 'allocate',
          tx_id: TX,
          job_id: JOB_A,
          amount: 0,
          from_job_id: JOB_A,
        } as CostBatchOp,
      ],
    }
    expect(validateCostBatchPayload(p)).toEqual([
      'op 1: allocate amount must be > 0',
      'op 1: from_job_id equals job_id',
    ])
  })

  it('only lets an ESTIMATE through as an other charge', () => {
    const p = {
      ...base,
      ops: [
        {
          op: 'other_charge',
          job_id: JOB_A,
          description: 'Supplies from truck',
          amount: 140,
        } as CostBatchOp,
      ],
    }
    expect(validateCostBatchPayload(p)).toEqual([
      'op 1: an other_charge from a batch must be described as an ESTIMATE (description starts with "ESTIMATE")',
    ])
    const ok = {
      ...base,
      ops: [
        {
          op: 'other_charge',
          job_id: JOB_A,
          description: 'estimate — office hours',
          amount: 0,
        } as CostBatchOp,
      ],
    }
    expect(validateCostBatchPayload(ok)).toEqual([])
  })

  it('needs an author on the batch to write a thread note', () => {
    const p = {
      label: 'x',
      reason: 'y',
      ops: [{ op: 'thread_note', job_id: JOB_A, body: 'hi' } as CostBatchOp],
    }
    expect(validateCostBatchPayload(p)).toEqual([
      'op 1: thread_note needs author_user_id on the batch',
    ])
  })

  it('names an unknown op and a bad uuid', () => {
    const p: CostBatchPayload = {
      ...base,
      ops: [
        { op: 'delete_payment', job_id: JOB_A } as unknown as CostBatchOp,
        { op: 'clock_repoint', session_id: 'nope', to_job_id: JOB_A },
      ],
    }
    expect(validateCostBatchPayload(p)).toEqual([
      'op 1: unknown op "delete_payment"',
      'op 2: clock_repoint needs session_id (uuid)',
    ])
  })
})

describe('summarizeCostBatchOps', () => {
  it('totals by job the way the database summary does, and tracks what left the from_job', () => {
    const s = summarizeCostBatchOps(good)
    expect(s.opCount).toBe(5)
    expect(s.byOp).toEqual({
      allocate: 1,
      supply_repoint: 1,
      clock_repoint: 1,
      other_charge: 1,
      thread_note: 1,
    })
    expect(s.byJob[JOB_A]).toEqual({
      allocated: 120.5,
      supply: 1,
      clockSessions: 1,
      otherCharges: 22857.14,
      notes: 1,
    })
    expect(s.byJob[JOB_B]).toBeUndefined()
    expect(s.releasedFrom).toEqual({ [JOB_B]: 120.5 })
  })

  it('rounds accumulated dollars to cents', () => {
    const s = summarizeCostBatchOps([
      { op: 'allocate', tx_id: TX, job_id: JOB_A, amount: 0.1 },
      { op: 'allocate', tx_id: TX, job_id: JOB_A, amount: 0.2 },
    ])
    expect(s.byJob[JOB_A]?.allocated).toBe(0.3)
  })
})

describe('buildCostBatchPayload', () => {
  it('trims and drops empty optionals', () => {
    expect(
      buildCostBatchPayload({
        ...base,
        label: '  Trace ledger rev b ',
        source_ref: '',
      }),
    ).toEqual({
      label: 'Trace ledger rev b',
      reason: 'book the ledger',
      author_user_id: USER,
      ops: good,
    })
  })

  it('throws with every problem listed', () => {
    expect(() =>
      buildCostBatchPayload({ label: '', reason: 'r', ops: [] }),
    ).toThrow('label is required; ops must be a non-empty array')
  })
})
