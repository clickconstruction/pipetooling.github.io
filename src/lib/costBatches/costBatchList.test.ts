import { describe, expect, it } from 'vitest'
import {
  costBatchOpWords,
  costBatchIdsTouchingJob,
  costBatchJobLines,
  costBatchOpJobIds,
  costBatchOpRowFromDb,
  costBatchOpTouchesJob,
  costBatchRevertReady,
  costBatchRevertTyped,
  costBatchRowFromDb,
  costBatchSummaryWords,
  sortCostBatchesNewestFirst,
} from './costBatchList'

const A = 'job-a'
const B = 'job-b'

describe('costBatchRowFromDb', () => {
  it('types a cost_batches row, the summary numbers as numbers', () => {
    const row = costBatchRowFromDb({
      id: 'b1',
      label: 'Move cost',
      reason: 'why',
      source_ref: null,
      author_label: 'Move cost screen',
      author_user_id: 'u1',
      applied_at: '2026-10-29T20:00:00Z',
      reverted_at: null,
      revert_reason: null,
      op_count: 3,
      summary: { by_job: { [A]: { allocated: '84.3', clock_sessions: 1, notes: 1 }, [B]: { notes: 1 } } },
    })
    expect(row).toEqual({
      id: 'b1',
      label: 'Move cost',
      reason: 'why',
      sourceRef: null,
      authorLabel: 'Move cost screen',
      authorUserId: 'u1',
      appliedAt: '2026-10-29T20:00:00Z',
      revertedAt: null,
      revertReason: null,
      opCount: 3,
      byJob: {
        [A]: { allocated: 84.3, supply: 0, clockSessions: 1, otherCharges: 0, notes: 1 },
        [B]: { allocated: 0, supply: 0, clockSessions: 0, otherCharges: 0, notes: 1 },
      },
    })
    expect(costBatchRowFromDb({ label: 'no id' })).toBeNull()
  })
})

describe('op job ids', () => {
  it('reads every job an op names in its target and images', () => {
    const allocate = costBatchOpRowFromDb({
      batch_id: 'b1',
      seq: 1,
      op_type: 'allocate',
      target: { op: 'allocate', job_id: A, from_job_id: B },
      before_image: { replaced: { job_id: B } },
      after_image: { action: 'insert', allocation: { job_id: A } },
    })!
    expect(costBatchOpJobIds(allocate).sort()).toEqual([A, B])
    const clock = costBatchOpRowFromDb({ batch_id: 'b1', seq: 2, op_type: 'clock_repoint', target: { op: 'clock_repoint', to_job_id: A }, before_image: { job_ledger_id: B }, after_image: { job_ledger_id: A } })!
    expect(costBatchOpJobIds(clock).sort()).toEqual([A, B])
    const note = costBatchOpRowFromDb({ batch_id: 'b1', seq: 3, op_type: 'thread_note', target: { op: 'thread_note', job_id: B }, before_image: null, after_image: { job_id: B } })!
    expect(costBatchOpJobIds(note)).toEqual([B])
    expect(costBatchOpTouchesJob(note, A)).toBe(false)
    expect(costBatchIdsTouchingJob([allocate, clock, note], A)).toEqual(new Set(['b1']))
    expect(costBatchIdsTouchingJob([note], A)).toEqual(new Set())
  })
})

describe('summary words', () => {
  const byJob = {
    [A]: { allocated: 31804.23, supply: 7, clockSessions: 77, otherCharges: 0, notes: 1 },
    [B]: { allocated: 0, supply: 0, clockSessions: 0, otherCharges: 0, notes: 1 },
  }

  it('sums the batch across jobs', () => {
    expect(costBatchSummaryWords(byJob)).toBe('allocated $31,804.23 · 7 invoices · 77 clock sessions · 2 notes')
    expect(costBatchSummaryWords(byJob, { allocate: 381 })).toBe('381 allocated ($31,804.23) · 7 invoices · 77 clock sessions · 2 notes')
    expect(costBatchSummaryWords({})).toBe('nothing recorded')
  })

  it('lines each job, the one that received rows first, a note-only job last', () => {
    expect(costBatchJobLines(byJob, (id) => (id === A ? 'Rough In' : 'Diamondback'))).toEqual([
      { jobId: A, label: 'Rough In', words: 'allocated $31,804.23 · 7 invoices · 77 clock sessions · 1 note' },
      { jobId: B, label: 'Diamondback', words: '1 note' },
    ])
  })
})

describe('revert confirmation', () => {
  it('needs the word, any case, and a reason, on a batch not yet reverted', () => {
    expect(costBatchRevertTyped(' Revert ')).toBe(true)
    expect(costBatchRevertTyped('rever')).toBe(false)
    expect(costBatchRevertReady({ revertedAt: null }, 'revert', 'wrong draw')).toBe(true)
    expect(costBatchRevertReady({ revertedAt: null }, 'revert', '  ')).toBe(false)
    expect(costBatchRevertReady({ revertedAt: null }, 'yes', 'wrong draw')).toBe(false)
    expect(costBatchRevertReady({ revertedAt: '2026-10-29T00:00:00Z' }, 'revert', 'wrong draw')).toBe(false)
  })
})

describe('sortCostBatchesNewestFirst', () => {
  it('orders by applied_at descending, ties by id', () => {
    const rows = [
      { id: 'b', appliedAt: '2026-10-01T00:00:00Z' },
      { id: 'c', appliedAt: '2026-10-29T00:00:00Z' },
      { id: 'a', appliedAt: '2026-10-01T00:00:00Z' },
    ]
    expect(sortCostBatchesNewestFirst(rows).map((r) => r.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('costBatchOpWords', () => {
  const label = (id: string) => (id === A ? 'J629 · Rough In' : id === B ? 'J583 · Diamondback' : id)
  it('names each op kind in one line', () => {
    expect(costBatchOpWords({ opType: 'allocate', target: { tx_id: '3f9a1b2c-0000', job_id: A, from_job_id: B, amount: 84.1 } }, label)).toBe('$84.10 of tx 3f9a1b2c… → J629 · Rough In (from J583 · Diamondback)')
    expect(costBatchOpWords({ opType: 'allocate', target: { tx_id: '3f9a1b2c-0000', job_id: A, amount: '12' } }, label)).toBe('$12.00 of tx 3f9a1b2c… → J629 · Rough In')
    expect(costBatchOpWords({ opType: 'supply_repoint', target: { invoice_id: '44a1bbbb-1', from_job_id: B, to_job_id: A } }, label)).toBe('invoice 44a1bbbb… J583 · Diamondback → J629 · Rough In')
    expect(costBatchOpWords({ opType: 'clock_repoint', target: { session_id: '55b2cccc-1', to_job_id: A } }, label)).toBe('session 55b2cccc… → J629 · Rough In')
    expect(costBatchOpWords({ opType: 'other_charge', target: { job_id: A, description: 'ESTIMATE — mobilization', amount: 22857.14 } }, label)).toBe('ESTIMATE — mobilization $22,857.14 on J629 · Rough In')
    expect(costBatchOpWords({ opType: 'thread_note', target: { job_id: B, body: `2026-10-29 — cost batch: ${'x'.repeat(120)}` } }, label)).toMatch(/^note on J583 · Diamondback: 2026-10-29 — cost batch: x+…$/)
    expect(costBatchOpWords({ opType: 'mystery', target: {} }, label)).toBe('mystery')
  })
})
