import type { MercuryJobSplit } from '../components/MercuryTransactionAllocationsModal'

/** Minimal allocation row shape (matches `mercury_transaction_job_allocations` selects). */
export type MercuryAllocationRowLike = {
  mercury_transaction_id: string
  job_id: string
  amount: number | string
  note: string | null
}

/** Minimal attribution row shape (matches `mercury_transaction_attributions` selects). */
export type MercuryAttributionRowLike = {
  mercury_transaction_id: string
  person_id: string | null
  user_id: string | null
}

export type MercuryRelationMaps = {
  allocationsByTxId: Map<string, MercuryJobSplit[]>
  /** Every loaded tx id is present (null = no attribution). */
  personIdByTxId: Map<string, string | null>
  userIdByTxId: Map<string, string | null>
  /** Distinct ids needed for label lookups (jobs_ledger / people / users). */
  jobIds: string[]
  personIds: string[]
  userIds: string[]
}

/** Split shape used across Banking, the snapshot section, and the Link… modal seed. */
export function splitFromAllocationRow(row: MercuryAllocationRowLike): MercuryJobSplit {
  const split: MercuryJobSplit = { job_id: row.job_id, amount: Number(row.amount) }
  if (row.note != null && row.note !== '') split.note = row.note
  return split
}

/**
 * Builds Banking's per-transaction relation maps from (complete, paged) relation
 * rows. Rows for transactions outside `loadedTxIds` are dropped so the label
 * lookups (`jobIds`/`personIds`/`userIds`) stay scoped to what the page shows;
 * every loaded id gets an explicit `null` attribution entry so "Without person"
 * counts see loaded-but-unattributed rows. Pure — the fetch is the caller's.
 */
export function buildMercuryRelationMaps(
  allocRows: readonly MercuryAllocationRowLike[],
  attrRows: readonly MercuryAttributionRowLike[],
  loadedTxIds: Iterable<string>,
): MercuryRelationMaps {
  const loaded = new Set(loadedTxIds)
  const allocationsByTxId = new Map<string, MercuryJobSplit[]>()
  const jobIds = new Set<string>()
  for (const row of allocRows) {
    const tid = row.mercury_transaction_id
    if (!loaded.has(tid)) continue
    const list = allocationsByTxId.get(tid) ?? []
    list.push(splitFromAllocationRow(row))
    allocationsByTxId.set(tid, list)
    jobIds.add(row.job_id)
  }

  const personIdByTxId = new Map<string, string | null>()
  const userIdByTxId = new Map<string, string | null>()
  const personIds = new Set<string>()
  const userIds = new Set<string>()
  for (const row of attrRows) {
    const tid = row.mercury_transaction_id
    if (!loaded.has(tid)) continue
    personIdByTxId.set(tid, row.person_id)
    userIdByTxId.set(tid, row.user_id)
    if (row.person_id) personIds.add(row.person_id)
    if (row.user_id) userIds.add(row.user_id)
  }
  for (const id of loaded) {
    if (!personIdByTxId.has(id)) personIdByTxId.set(id, null)
    if (!userIdByTxId.has(id)) userIdByTxId.set(id, null)
  }

  return {
    allocationsByTxId,
    personIdByTxId,
    userIdByTxId,
    jobIds: [...jobIds],
    personIds: [...personIds],
    userIds: [...userIds],
  }
}
