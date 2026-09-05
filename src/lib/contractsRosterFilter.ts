import type { PersonContractStatusCounts } from './personContractStatusCounts'

/**
 * Roster filter for People → Contracts (v2.1406): buckets each person from
 * their status counts and gates visibility under the chip filter. "Needs
 * attention" = anything unsent; "waiting" = sent and nothing unsent; "done" =
 * documents exist and all are signed; "none" = no documents at all (visible
 * only under Everyone). The active filter is ignored while a search query is
 * present — search always looks across everyone.
 */

export type ContractsRosterBucket = 'attention' | 'waiting' | 'done' | 'none'
export type ContractsRosterFilter = 'attention' | 'waiting' | 'done' | 'everyone'

export const CONTRACTS_ROSTER_FILTER_STORAGE_KEY = 'people_contracts_roster_filter_v1'

export function contractsRosterBucket(counts: PersonContractStatusCounts, officePending = 0): ContractsRosterBucket {
  // Two-party forms (v2.2803): a signed form still waiting on the office is the office's to act on.
  if (counts.unsent > 0 || officePending > 0) return 'attention'
  if (counts.sent > 0) return 'waiting'
  if (counts.signed > 0) return 'done'
  return 'none'
}

export function personVisibleUnderContractsFilter(bucket: ContractsRosterBucket, filter: ContractsRosterFilter): boolean {
  return filter === 'everyone' || bucket === filter
}

/** Stored preference parser; null for anything unknown (falls back to the smart default). */
export function parseContractsRosterFilter(raw: string | null | undefined): ContractsRosterFilter | null {
  return raw === 'attention' || raw === 'waiting' || raw === 'done' || raw === 'everyone' ? raw : null
}

/** First-visit default: open on the actionable list when it has anyone, else Everyone. */
export function defaultContractsRosterFilter(attentionCount: number): ContractsRosterFilter {
  return attentionCount > 0 ? 'attention' : 'everyone'
}
