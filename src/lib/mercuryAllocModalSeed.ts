import type { MercuryJobSplit } from '../components/MercuryTransactionAllocationsModal'
import {
  splitFromAllocationRow,
  type MercuryAllocationRowLike,
  type MercuryAttributionRowLike,
} from './mercuryRelationMaps'

/**
 * What the database says about one transaction's splits + attribution at a
 * point in time. The Link… modal reads one of these when it opens (its seed)
 * and another right before it saves; `replace_mercury_transaction_splits` is
 * DELETE + INSERT of the modal's list, so saving over a seed the DB no longer
 * matches would silently erase whatever landed in between (J33-N1).
 */
export type MercurySplitSeedState = {
  splits: MercuryJobSplit[]
  personId: string | null
  userId: string | null
}

/** Splits for `txId` from (possibly multi-tx) allocation rows, in row order. */
export function splitsFromAllocationRows(rows: readonly MercuryAllocationRowLike[], txId: string): MercuryJobSplit[] {
  const out: MercuryJobSplit[] = []
  for (const row of rows) {
    if (row.mercury_transaction_id !== txId) continue
    out.push(splitFromAllocationRow(row))
  }
  return out
}

/** Attribution for `txId` (first matching row; the table is keyed by tx id). */
export function attributionFromRows(
  rows: readonly MercuryAttributionRowLike[],
  txId: string,
): { personId: string | null; userId: string | null } {
  for (const row of rows) {
    if (row.mercury_transaction_id === txId) return { personId: row.person_id, userId: row.user_id }
  }
  return { personId: null, userId: null }
}

export function seedStateFromRows(
  allocRows: readonly MercuryAllocationRowLike[],
  attrRows: readonly MercuryAttributionRowLike[],
  txId: string,
): MercurySplitSeedState {
  const attr = attributionFromRows(attrRows, txId)
  return { splits: splitsFromAllocationRows(allocRows, txId), personId: attr.personId, userId: attr.userId }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Canonical form for equality: sorted by (job_id, amount, note); cents-rounded; blank note ≡ no note. */
export function normalizeMercurySplits(splits: readonly MercuryJobSplit[]): { job_id: string; amount: number; note: string }[] {
  return splits
    .map((s) => ({ job_id: s.job_id, amount: round2(Number(s.amount)), note: (s.note ?? '').trim() }))
    .sort((a, b) => a.job_id.localeCompare(b.job_id) || a.amount - b.amount || a.note.localeCompare(b.note))
}

export function mercurySplitsEqual(a: readonly MercuryJobSplit[], b: readonly MercuryJobSplit[]): boolean {
  if (a.length !== b.length) return false
  const na = normalizeMercurySplits(a)
  const nb = normalizeMercurySplits(b)
  return na.every((x, i) => {
    const y = nb[i]
    return y !== undefined && x.job_id === y.job_id && x.amount === y.amount && x.note === y.note
  })
}

export function seedStatesEqual(a: MercurySplitSeedState, b: MercurySplitSeedState): boolean {
  return a.personId === b.personId && a.userId === b.userId && mercurySplitsEqual(a.splits, b.splits)
}

/**
 * Optimistic-concurrency decision for Save: `seed` is what the modal loaded when
 * it opened; `current` is a fresh by-id read taken right before the RPC.
 * 'ok' → safe to replace; 'changed' → someone else saved in between, refuse.
 */
export function decideSplitSaveGuard(seed: MercurySplitSeedState | null, current: MercurySplitSeedState): 'ok' | 'changed' | 'unverified' {
  if (seed === null) return 'unverified'
  return seedStatesEqual(seed, current) ? 'ok' : 'changed'
}
