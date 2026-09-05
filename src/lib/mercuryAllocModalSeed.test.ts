import { describe, expect, it } from 'vitest'
import {
  attributionFromRows,
  decideSplitSaveGuard,
  mercurySplitsEqual,
  normalizeMercurySplits,
  seedStateFromRows,
  seedStatesEqual,
  splitsFromAllocationRows,
} from './mercuryAllocModalSeed'

const alloc = (tx: string, job: string, amount: number | string, note: string | null = null) => ({
  mercury_transaction_id: tx,
  job_id: job,
  amount,
  note,
})

describe('splitsFromAllocationRows / attributionFromRows', () => {
  it('keeps only the target transaction and preserves row order', () => {
    const rows = [alloc('t1', 'jA', -10), alloc('t2', 'jB', -99), alloc('t1', 'jB', '-20', 'valves')]
    expect(splitsFromAllocationRows(rows, 't1')).toEqual([
      { job_id: 'jA', amount: -10 },
      { job_id: 'jB', amount: -20, note: 'valves' },
    ])
    expect(splitsFromAllocationRows(rows, 't9')).toEqual([])
  })

  it('reads the attribution row for the transaction, null when absent', () => {
    const rows = [{ mercury_transaction_id: 't1', person_id: null, user_id: 'u1' }]
    expect(attributionFromRows(rows, 't1')).toEqual({ personId: null, userId: 'u1' })
    expect(attributionFromRows(rows, 't2')).toEqual({ personId: null, userId: null })
  })

  it('seedStateFromRows combines both', () => {
    expect(seedStateFromRows([alloc('t1', 'jA', -30)], [{ mercury_transaction_id: 't1', person_id: 'p1', user_id: null }], 't1')).toEqual({
      splits: [{ job_id: 'jA', amount: -30 }],
      personId: 'p1',
      userId: null,
    })
  })
})

describe('mercurySplitsEqual', () => {
  it('ignores order, cents-rounds, and treats blank/null notes alike', () => {
    const a = [
      { job_id: 'jA', amount: -10.004, note: null },
      { job_id: 'jB', amount: -20, note: ' valves ' },
    ]
    const b = [
      { job_id: 'jB', amount: -20, note: 'valves' },
      { job_id: 'jA', amount: -10, note: '' },
    ]
    expect(mercurySplitsEqual(a, b)).toBe(true)
    expect(normalizeMercurySplits(a)[0]).toEqual({ job_id: 'jA', amount: -10, note: '' })
  })

  it('detects a changed amount, note, job, or count', () => {
    const base = [{ job_id: 'jA', amount: -10 }]
    expect(mercurySplitsEqual(base, [{ job_id: 'jA', amount: -10.01 }])).toBe(false)
    expect(mercurySplitsEqual(base, [{ job_id: 'jA', amount: -10, note: 'x' }])).toBe(false)
    expect(mercurySplitsEqual(base, [{ job_id: 'jB', amount: -10 }])).toBe(false)
    expect(mercurySplitsEqual(base, [])).toBe(false)
    expect(mercurySplitsEqual([], [])).toBe(true)
  })
})

describe('decideSplitSaveGuard (the seed-vs-refetched guard before REPLACE)', () => {
  const seed = { splits: [{ job_id: 'jA', amount: -10 }], personId: null, userId: 'u1' }

  it('ok when the DB still matches what the modal opened on', () => {
    expect(decideSplitSaveGuard(seed, { splits: [{ job_id: 'jA', amount: -10, note: '' }], personId: null, userId: 'u1' })).toBe('ok')
  })

  it('changed when another save added a split in between — the erasure case', () => {
    const current = { ...seed, splits: [...seed.splits, { job_id: 'jB', amount: -5 }] }
    expect(decideSplitSaveGuard(seed, current)).toBe('changed')
  })

  it('changed when the attribution moved, even with identical splits', () => {
    expect(decideSplitSaveGuard(seed, { ...seed, userId: 'u2' })).toBe('changed')
    expect(decideSplitSaveGuard(seed, { ...seed, userId: null, personId: 'p1' })).toBe('changed')
    expect(seedStatesEqual(seed, { ...seed })).toBe(true)
  })

  it('unverified when the modal never got its seed (Save must not proceed)', () => {
    expect(decideSplitSaveGuard(null, seed)).toBe('unverified')
  })

  it('an empty page-map seed never masks real splits: the DB read is the seed', () => {
    // The old bug: the parent map (truncated) said [] while the DB had 2 splits. The modal
    // now opens on the DB state, so a stale-empty parent seed is irrelevant to the guard.
    const dbAtOpen = { splits: [{ job_id: 'jA', amount: -6 }, { job_id: 'jB', amount: -4 }], personId: null, userId: null }
    expect(decideSplitSaveGuard(dbAtOpen, dbAtOpen)).toBe('ok')
    expect(decideSplitSaveGuard({ splits: [], personId: null, userId: null }, dbAtOpen)).toBe('changed')
  })
})
