import { describe, it, expect } from 'vitest'
import {
  UNLABELED_GROUP_KEY,
  UNLABELED_GROUP_NAME,
  buildUserDateFlatBreakdown,
  buildUserJobLabelBreakdown,
  buildUserLabelTopBreakdown,
  type UserReviewRpcRow,
} from './buildUserJobLabelBreakdown'

// Respect explicit `null` / `undefined` overrides by using `in` so callers can null out a field.
function pick<K extends keyof UserReviewRpcRow>(
  overrides: Partial<UserReviewRpcRow>,
  key: K,
  fallback: UserReviewRpcRow[K],
): UserReviewRpcRow[K] {
  return key in overrides ? (overrides[key] as UserReviewRpcRow[K]) : fallback
}

function row(overrides: Partial<UserReviewRpcRow> = {}): UserReviewRpcRow {
  return {
    mercury_transaction_id: pick(overrides, 'mercury_transaction_id', 'tx-1'),
    posted_at: pick(overrides, 'posted_at', '2026-05-19T15:00:00Z'),
    created_at: pick(overrides, 'created_at', '2026-05-19T15:00:00Z'),
    amount: pick(overrides, 'amount', -100),
    counterparty_name: pick(overrides, 'counterparty_name', 'Home Depot'),
    attribution_source: pick(overrides, 'attribution_source', 'user'),
    attribution_person_id: pick(overrides, 'attribution_person_id', null),
    label_id: pick(overrides, 'label_id', null),
    label_name: pick(overrides, 'label_name', null),
    allocation_id: pick(overrides, 'allocation_id', null),
    job_id: pick(overrides, 'job_id', null),
    allocation_amount: pick(overrides, 'allocation_amount', null),
  }
}

describe('buildUserJobLabelBreakdown', () => {
  it('returns empty buckets when no rows', () => {
    const out = buildUserJobLabelBreakdown({ rows: [] })
    expect(out.grandTotal).toEqual({ totalAmount: 0, count: 0 })
    expect(out.totals.byUser).toEqual({ totalAmount: 0, count: 0 })
    expect(out.totals.byPerson).toEqual({ totalAmount: 0, count: 0 })
    expect(out.unallocated.count).toBe(0)
    expect(out.perJob).toEqual([])
  })

  it('places unallocated tx in the unallocated bucket with the full tx amount', () => {
    const out = buildUserJobLabelBreakdown({
      rows: [row({ mercury_transaction_id: 'tx-1', amount: -250 })],
    })
    expect(out.unallocated.count).toBe(1)
    expect(out.unallocated.totalAmount).toBe(-250)
    expect(out.unallocated.rows[0]!.mercuryTransactionId).toBe('tx-1')
    expect(out.unallocated.rows[0]!.allocationAmount).toBeNull()
    expect(out.perJob).toEqual([])
    expect(out.grandTotal.totalAmount).toBe(-250)
    expect(out.grandTotal.count).toBe(1)
  })

  it('splits one tx across two jobs and the allocation amounts sum to the tx amount', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a2',
        job_id: 'job-B',
        allocation_amount: -200,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
    ]
    const out = buildUserJobLabelBreakdown({
      rows,
      jobLabelById: { 'job-A': 'HCP #100 · Smith', 'job-B': 'HCP #101 · Jones' },
    })
    expect(out.unallocated.count).toBe(0)
    expect(out.grandTotal).toEqual({ totalAmount: -300, count: 1 })
    expect(out.perJob).toHaveLength(2)
    // Sorted by |totalAmount| desc — job-B (|200|) before job-A (|100|).
    expect(out.perJob[0]!.jobId).toBe('job-B')
    expect(out.perJob[0]!.totalAmount).toBe(-200)
    expect(out.perJob[0]!.jobLabel).toBe('HCP #101 · Jones')
    expect(out.perJob[1]!.jobId).toBe('job-A')
    expect(out.perJob[1]!.totalAmount).toBe(-100)
    const sumAllocations = out.perJob.reduce((acc, j) => acc + j.totalAmount, 0)
    expect(sumAllocations).toBe(-300)
  })

  it('groups by accounting label under a job', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -180,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-2',
        amount: -120,
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -120,
        label_id: 'lbl-tools',
        label_name: 'Tools',
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.perJob).toHaveLength(1)
    const job = out.perJob[0]!
    expect(job.jobId).toBe('job-A')
    expect(job.count).toBe(2)
    expect(job.totalAmount).toBe(-300)
    // Two label groups; Parts (|180|) before Tools (|120|).
    expect(job.labelGroups).toHaveLength(2)
    expect(job.labelGroups[0]!.labelName).toBe('Parts')
    expect(job.labelGroups[0]!.totalAmount).toBe(-180)
    expect(job.labelGroups[1]!.labelName).toBe('Tools')
    expect(job.labelGroups[1]!.totalAmount).toBe(-120)
  })

  it('falls back to "Unlabeled" group when allocation has no label assignment', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -50,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -50,
        label_id: null,
        label_name: null,
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.perJob[0]!.labelGroups).toHaveLength(1)
    const group = out.perJob[0]!.labelGroups[0]!
    expect(group.labelId).toBeNull()
    expect(group.labelName).toBe(UNLABELED_GROUP_NAME)
    expect(group.rows[0]!.labelName).toBe(UNLABELED_GROUP_NAME)
    // Key match for UI dedupe.
    expect(UNLABELED_GROUP_KEY).toBe('__unlabeled__')
  })

  it('preserves signs (positive and negative allocation amounts)', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: 500,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: 500,
        label_id: 'lbl-deposit',
        label_name: 'Deposit',
        attribution_source: 'user',
      }),
      row({
        mercury_transaction_id: 'tx-2',
        amount: -200,
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -200,
        label_id: 'lbl-parts',
        label_name: 'Parts',
        attribution_source: 'user',
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.perJob[0]!.totalAmount).toBe(300)
    // Both label groups present, sorted by |amount| desc — Deposit (500) before Parts (200).
    expect(out.perJob[0]!.labelGroups[0]!.labelName).toBe('Deposit')
    expect(out.perJob[0]!.labelGroups[0]!.totalAmount).toBe(500)
    expect(out.perJob[0]!.labelGroups[1]!.totalAmount).toBe(-200)
  })

  it('partitions distinct-tx totals between user and person sources without merging', () => {
    const rows: UserReviewRpcRow[] = [
      row({ mercury_transaction_id: 'tx-1', amount: -100, attribution_source: 'user' }),
      row({
        mercury_transaction_id: 'tx-2',
        amount: -50,
        attribution_source: 'person',
        attribution_person_id: 'person-X',
      }),
      row({
        mercury_transaction_id: 'tx-3',
        amount: -25,
        attribution_source: 'person',
        attribution_person_id: 'person-Y',
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.totals.byUser).toEqual({ totalAmount: -100, count: 1 })
    expect(out.totals.byPerson).toEqual({ totalAmount: -75, count: 2 })
    expect(out.grandTotal).toEqual({ totalAmount: -175, count: 3 })
    // unallocated bucket should contain all three.
    expect(out.unallocated.count).toBe(3)
    // Each row tagged with its source for the UI source pill.
    const sources = new Set(out.unallocated.rows.map((r) => r.attributionSource))
    expect(sources).toEqual(new Set(['user', 'person']))
  })

  it('ignores rows whose attribution_source is not user or person', () => {
    const rows: UserReviewRpcRow[] = [
      row({ mercury_transaction_id: 'tx-good', amount: -10, attribution_source: 'user' }),
      row({ mercury_transaction_id: 'tx-bad', amount: -999, attribution_source: null }),
      row({ mercury_transaction_id: 'tx-bad2', amount: -888, attribution_source: 'something_else' }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.grandTotal).toEqual({ totalAmount: -10, count: 1 })
    expect(out.unallocated.count).toBe(1)
    expect(out.unallocated.rows[0]!.mercuryTransactionId).toBe('tx-good')
  })

  it('does not double-count a tx that has both allocated and unallocated RPC rows', () => {
    // Defensive: RPC should never emit both shapes for one tx, but the helper must be robust.
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -100,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({ mercury_transaction_id: 'tx-1', amount: -100, allocation_id: null, job_id: null }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.grandTotal).toEqual({ totalAmount: -100, count: 1 })
    expect(out.unallocated.count).toBe(0)
    expect(out.perJob[0]!.totalAmount).toBe(-100)
  })

  it('falls back to job_id when no jobLabelById entry exists', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        allocation_id: 'a1',
        job_id: 'job-XYZ',
        allocation_amount: -10,
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.perJob[0]!.jobLabel).toBe('job-XYZ')
  })

  it('tie-breaks jobs of equal |amount| by jobLabel ascending', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
      }),
      row({
        mercury_transaction_id: 'tx-2',
        allocation_id: 'a2',
        job_id: 'job-B',
        allocation_amount: -100,
      }),
    ]
    const out = buildUserJobLabelBreakdown({
      rows,
      jobLabelById: { 'job-A': 'Banana', 'job-B': 'Apple' },
    })
    expect(out.perJob[0]!.jobLabel).toBe('Apple')
    expect(out.perJob[1]!.jobLabel).toBe('Banana')
  })

  it('coerces numeric amounts that arrive as strings (postgres numeric)', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: '-300.5500',
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: '-300.5500',
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    expect(out.perJob[0]!.totalAmount).toBeCloseTo(-300.55, 4)
    expect(out.grandTotal.totalAmount).toBeCloseTo(-300.55, 4)
  })

  it('sorts tx rows within a label group by posted_at desc with id tie-break', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-old',
        posted_at: '2026-05-10T10:00:00Z',
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -10,
        label_id: 'lbl',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-new',
        posted_at: '2026-05-19T10:00:00Z',
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -10,
        label_id: 'lbl',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-id-tiebreak-1',
        posted_at: '2026-05-19T10:00:00Z',
        allocation_id: 'a3',
        job_id: 'job-A',
        allocation_amount: -10,
        label_id: 'lbl',
        label_name: 'Parts',
      }),
    ]
    const out = buildUserJobLabelBreakdown({ rows })
    const group = out.perJob[0]!.labelGroups[0]!
    expect(group.rows.map((r) => r.mercuryTransactionId)).toEqual([
      'tx-id-tiebreak-1',
      'tx-new',
      'tx-old',
    ])
  })
})

describe('buildUserLabelTopBreakdown', () => {
  it('returns empty breakdown when no rows', () => {
    const out = buildUserLabelTopBreakdown({ rows: [] })
    expect(out.grandTotal).toEqual({ totalAmount: 0, count: 0 })
    expect(out.totals.byUser).toEqual({ totalAmount: 0, count: 0 })
    expect(out.totals.byPerson).toEqual({ totalAmount: 0, count: 0 })
    expect(out.perLabel).toEqual([])
  })

  it('splits one tx across two labels and the allocation amounts sum to the tx amount', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -200,
        label_id: 'lbl-tools',
        label_name: 'Tools',
      }),
    ]
    const out = buildUserLabelTopBreakdown({
      rows,
      jobLabelById: { 'job-A': 'HCP #100 · Smith' },
    })
    expect(out.grandTotal).toEqual({ totalAmount: -300, count: 1 })
    expect(out.perLabel).toHaveLength(2)
    // Sorted by |totalAmount| desc — Tools (|200|) before Parts (|100|).
    expect(out.perLabel[0]!.labelName).toBe('Tools')
    expect(out.perLabel[0]!.totalAmount).toBe(-200)
    expect(out.perLabel[0]!.count).toBe(1)
    expect(out.perLabel[0]!.rows).toHaveLength(1)
    expect(out.perLabel[0]!.rows[0]!.jobLabel).toBe('HCP #100 · Smith')
    expect(out.perLabel[1]!.labelName).toBe('Parts')
    expect(out.perLabel[1]!.totalAmount).toBe(-100)
    const sumAllocations = out.perLabel.reduce((acc, b) => acc + b.totalAmount, 0)
    expect(sumAllocations).toBe(-300)
  })

  it('places unallocated tx into the synthetic Unlabeled bucket with allocationAmount null', () => {
    const rows: UserReviewRpcRow[] = [
      row({ mercury_transaction_id: 'tx-1', amount: -250 }),
    ]
    const out = buildUserLabelTopBreakdown({ rows })
    expect(out.perLabel).toHaveLength(1)
    const bucket = out.perLabel[0]!
    expect(bucket.labelId).toBeNull()
    expect(bucket.labelName).toBe(UNLABELED_GROUP_NAME)
    expect(bucket.totalAmount).toBe(-250)
    expect(bucket.count).toBe(1)
    const txRow = bucket.rows[0]!
    expect(txRow.mercuryTransactionId).toBe('tx-1')
    expect(txRow.allocationAmount).toBeNull()
    expect(txRow.jobId).toBeNull()
    expect(txRow.jobLabel).toBeNull()
  })

  it('merges labeled allocations and unallocated txs into the same Unlabeled bucket when applicable', () => {
    const rows: UserReviewRpcRow[] = [
      // Unallocated tx — lands in Unlabeled.
      row({ mercury_transaction_id: 'tx-1', amount: -50 }),
      // Allocation with no label_id — also Unlabeled.
      row({
        mercury_transaction_id: 'tx-2',
        amount: -30,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -30,
        label_id: null,
        label_name: null,
      }),
    ]
    const out = buildUserLabelTopBreakdown({ rows })
    expect(out.perLabel).toHaveLength(1)
    const bucket = out.perLabel[0]!
    expect(bucket.labelName).toBe(UNLABELED_GROUP_NAME)
    expect(bucket.labelId).toBeNull()
    expect(bucket.count).toBe(2)
    expect(bucket.totalAmount).toBe(-80)
    // Key used for unlabeled bucket matches the public constant.
    expect(UNLABELED_GROUP_KEY).toBe('__unlabeled__')
  })

  it('resolves jobLabel from jobLabelById and falls back to job_id when missing', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        allocation_id: 'a1',
        job_id: 'job-known',
        allocation_amount: -100,
        label_id: 'lbl',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-2',
        allocation_id: 'a2',
        job_id: 'job-unknown',
        allocation_amount: -50,
        label_id: 'lbl',
        label_name: 'Parts',
      }),
    ]
    const out = buildUserLabelTopBreakdown({
      rows,
      jobLabelById: { 'job-known': 'HCP #1 · Smith' },
    })
    const bucket = out.perLabel[0]!
    const byTxId = new Map(bucket.rows.map((r) => [r.mercuryTransactionId, r.jobLabel]))
    expect(byTxId.get('tx-1')).toBe('HCP #1 · Smith')
    expect(byTxId.get('tx-2')).toBe('job-unknown')
  })

  it('ties between labels of equal |amount| break by labelName ascending', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-b',
        label_name: 'Banana',
      }),
      row({
        mercury_transaction_id: 'tx-2',
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-a',
        label_name: 'Apple',
      }),
    ]
    const out = buildUserLabelTopBreakdown({ rows })
    expect(out.perLabel[0]!.labelName).toBe('Apple')
    expect(out.perLabel[1]!.labelName).toBe('Banana')
  })
})

describe('buildUserDateFlatBreakdown', () => {
  it('returns empty breakdown when no rows', () => {
    const out = buildUserDateFlatBreakdown({ rows: [] })
    expect(out.grandTotal).toEqual({ totalAmount: 0, count: 0 })
    expect(out.rows).toEqual([])
  })

  it('emits exactly one row per distinct tx; rows.length === grandTotal.count', () => {
    const rows: UserReviewRpcRow[] = [
      // tx-1: 2 allocations
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a2',
        job_id: 'job-B',
        allocation_amount: -200,
        label_id: 'lbl-tools',
        label_name: 'Tools',
      }),
      // tx-2: single allocation
      row({
        mercury_transaction_id: 'tx-2',
        amount: -50,
        allocation_id: 'a3',
        job_id: 'job-A',
        allocation_amount: -50,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      // tx-3: unallocated
      row({ mercury_transaction_id: 'tx-3', amount: -10 }),
    ]
    const out = buildUserDateFlatBreakdown({ rows })
    expect(out.rows).toHaveLength(out.grandTotal.count)
    expect(out.rows).toHaveLength(3)
  })

  it('multi-allocation tx picks largest |allocation_amount| for display fields and sets hasMultipleAllocations', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        allocation_id: 'a2',
        job_id: 'job-B',
        allocation_amount: -200,
        label_id: 'lbl-tools',
        label_name: 'Tools',
      }),
    ]
    const out = buildUserDateFlatBreakdown({
      rows,
      jobLabelById: { 'job-A': 'A label', 'job-B': 'B label' },
    })
    expect(out.rows).toHaveLength(1)
    const txRow = out.rows[0]!
    expect(txRow.mercuryTransactionId).toBe('tx-1')
    expect(txRow.hasMultipleAllocations).toBe(true)
    // Winner is a2 (|200| > |100|): job-B / Tools.
    expect(txRow.jobId).toBe('job-B')
    expect(txRow.jobLabel).toBe('B label')
    expect(txRow.labelId).toBe('lbl-tools')
    expect(txRow.labelName).toBe('Tools')
    // Display amount is the full tx amount, not a per-allocation slice.
    expect(txRow.amount).toBe(-300)
  })

  it('ties between equal |allocation_amount| break by allocation_id ascending', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-1',
        amount: -200,
        allocation_id: 'alloc-z',
        job_id: 'job-Z',
        allocation_amount: -100,
        label_id: 'lbl-z',
        label_name: 'Zeta',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -200,
        allocation_id: 'alloc-a',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-a',
        label_name: 'Alpha',
      }),
    ]
    const out = buildUserDateFlatBreakdown({ rows })
    expect(out.rows).toHaveLength(1)
    // alloc-a wins (ascending allocation_id).
    expect(out.rows[0]!.jobId).toBe('job-A')
    expect(out.rows[0]!.labelName).toBe('Alpha')
  })

  it('unallocated tx surfaces with jobLabel null and labelName Unlabeled', () => {
    const rows: UserReviewRpcRow[] = [row({ mercury_transaction_id: 'tx-1', amount: -25 })]
    const out = buildUserDateFlatBreakdown({ rows })
    expect(out.rows).toHaveLength(1)
    const txRow = out.rows[0]!
    expect(txRow.jobId).toBeNull()
    expect(txRow.jobLabel).toBeNull()
    expect(txRow.labelId).toBeNull()
    expect(txRow.labelName).toBe(UNLABELED_GROUP_NAME)
    expect(txRow.hasMultipleAllocations).toBe(false)
    expect(txRow.allocationAmount).toBeNull()
  })

  it('sorts by posted_at desc, falls back to createdAt when posted_at null, ties break by tx id asc', () => {
    const rows: UserReviewRpcRow[] = [
      row({
        mercury_transaction_id: 'tx-old',
        posted_at: '2026-05-10T10:00:00Z',
        created_at: '2026-05-10T10:00:00Z',
        amount: -10,
      }),
      row({
        mercury_transaction_id: 'tx-new',
        posted_at: '2026-05-19T10:00:00Z',
        created_at: '2026-05-19T10:00:00Z',
        amount: -10,
      }),
      row({
        mercury_transaction_id: 'tx-id-tiebreak-1',
        posted_at: '2026-05-19T10:00:00Z',
        created_at: '2026-05-19T10:00:00Z',
        amount: -10,
      }),
      row({
        // posted_at null → createdAt fallback at the same instant as the others
        mercury_transaction_id: 'tx-by-created',
        posted_at: null,
        created_at: '2026-05-19T10:00:00Z',
        amount: -10,
      }),
    ]
    const out = buildUserDateFlatBreakdown({ rows })
    expect(out.rows.map((r) => r.mercuryTransactionId)).toEqual([
      'tx-by-created',
      'tx-id-tiebreak-1',
      'tx-new',
      'tx-old',
    ])
  })
})

describe('breakdown totals consistency across sort modes', () => {
  function fixture(): UserReviewRpcRow[] {
    return [
      // tx-1: user, 2 allocations split across labels under one job
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        attribution_source: 'user',
        allocation_id: 'a1',
        job_id: 'job-A',
        allocation_amount: -100,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      row({
        mercury_transaction_id: 'tx-1',
        amount: -300,
        attribution_source: 'user',
        allocation_id: 'a2',
        job_id: 'job-A',
        allocation_amount: -200,
        label_id: 'lbl-tools',
        label_name: 'Tools',
      }),
      // tx-2: person, single allocation, different job
      row({
        mercury_transaction_id: 'tx-2',
        amount: -150,
        attribution_source: 'person',
        attribution_person_id: 'person-X',
        allocation_id: 'a3',
        job_id: 'job-B',
        allocation_amount: -150,
        label_id: 'lbl-parts',
        label_name: 'Parts',
      }),
      // tx-3: user, unallocated
      row({
        mercury_transaction_id: 'tx-3',
        amount: -75,
        attribution_source: 'user',
      }),
      // tx-4: person, unallocated, positive (refund)
      row({
        mercury_transaction_id: 'tx-4',
        amount: 50,
        attribution_source: 'person',
        attribution_person_id: 'person-Y',
      }),
    ]
  }

  it('grandTotal and totals match across all three helpers for the same fixture', () => {
    const rows = fixture()
    const j = buildUserJobLabelBreakdown({ rows })
    const l = buildUserLabelTopBreakdown({ rows })
    const d = buildUserDateFlatBreakdown({ rows })
    expect(l.grandTotal).toEqual(j.grandTotal)
    expect(d.grandTotal).toEqual(j.grandTotal)
    expect(l.totals).toEqual(j.totals)
    expect(d.totals).toEqual(j.totals)
    // Sanity: 4 distinct txs (tx-1, tx-2, tx-3, tx-4).
    expect(j.grandTotal.count).toBe(4)
    // -300 + -150 + -75 + 50 = -475
    expect(j.grandTotal.totalAmount).toBe(-475)
  })

  it('By-Date emits one row per distinct tx — same count as grandTotal across the fixture', () => {
    const rows = fixture()
    const j = buildUserJobLabelBreakdown({ rows })
    const d = buildUserDateFlatBreakdown({ rows })
    expect(d.rows).toHaveLength(j.grandTotal.count)
  })

  it('By-Label sum of bucket totals equals sum of perJob totals plus unallocated total in By-Job', () => {
    const rows = fixture()
    const j = buildUserJobLabelBreakdown({ rows })
    const l = buildUserLabelTopBreakdown({ rows })
    const labelSum = l.perLabel.reduce((acc, b) => acc + b.totalAmount, 0)
    const jobSum =
      j.perJob.reduce((acc, p) => acc + p.totalAmount, 0) + j.unallocated.totalAmount
    expect(labelSum).toBeCloseTo(jobSum, 4)
  })
})
