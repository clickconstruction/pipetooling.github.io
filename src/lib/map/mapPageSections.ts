/**
 * The Map page's sections (v2.4802, Map page refresh PR 2b). Pure.
 *
 * A pin means what the row's dot means elsewhere in the app: a job takes its
 * Pipeline section's color (`jobsMap.ts`, the board's own status dots) and a
 * red ring in Collections; a bid takes its Bid Board section's color and the
 * due ring; an estimate is violet. The chips over the map are the key and the
 * switches, with the count of placed records in each. Paid, Lost and
 * Estimates start off — the live work is what the office is looking at.
 */
import { JOBS_MAP_COLLECTIONS_RING_COLOR, JOBS_MAP_SECTIONS, JOBS_MAP_SECTION_COLOR, JOBS_MAP_SECTION_LABEL, type JobsMapSection } from '../jobs/jobsMap'
import { normalizeJobsLedgerStatus } from '../jobsLedgerStatusPipeline'
import { BID_BOARD_MAP_DUE_RING_COLOR, type BidBoardMapDueTone } from '../bids/bidBoardMap'
import { bidBoardDueCellParts } from '../bids/bidBoardDateCells'
import type { SubmissionSectionKey } from '../bids/submissionSections'

export type { JobsMapSection, BidBoardMapDueTone }
export { JOBS_MAP_COLLECTIONS_RING_COLOR, JOBS_MAP_SECTIONS, JOBS_MAP_SECTION_COLOR, JOBS_MAP_SECTION_LABEL, BID_BOARD_MAP_DUE_RING_COLOR }

export const MAP_PAGE_ESTIMATE_COLOR = '#8b5cf6'
/** A job whose status is not a Pipeline section, or a bid the board cannot place. */
export const MAP_PAGE_UNKNOWN_COLOR = '#9ca3af'

/** `jobs_ledger.status` → the Pipeline section; null for a status off the pipeline. */
export function mapPageJobSection(status: string | null | undefined): JobsMapSection | null {
  const k = normalizeJobsLedgerStatus(status)
  if (!k) return null
  return k === 'ready_to_bill' ? 'readyToBill' : k
}

/** The bid's due ring: overdue or soon for an unsent bid with a due date, as the Bid Board draws it. */
export function mapPageBidDueTone(dueDate: string | null | undefined, outcome: string | null | undefined, dateSent: string | null | undefined, today: Date = new Date()): BidBoardMapDueTone | null {
  const due = bidBoardDueCellParts(dueDate, today, outcome, dateSent)
  return due && (due.urgency === 'overdue' || due.urgency === 'soon') ? due.urgency : null
}

export const MAP_PAGE_DEFAULT_JOB_SECTIONS: Record<JobsMapSection, boolean> = {
  waiting: true,
  working: true,
  readyToBill: true,
  billed: true,
  paid: false,
}

/** A cluster wears the most urgent ring any member has: Collections, then overdue, then due soon. */
export const MAP_PAGE_CLUSTER_RING_PRIORITY: readonly string[] = [JOBS_MAP_COLLECTIONS_RING_COLOR, BID_BOARD_MAP_DUE_RING_COLOR.overdue, BID_BOARD_MAP_DUE_RING_COLOR.soon]

export type MapPageSectionEntity = {
  kind: 'job' | 'bid' | 'estimate'
  jobSection?: JobsMapSection | null
  inCollections?: boolean
  bidSection?: SubmissionSectionKey
}

export type MapPageLegendCounts = {
  jobs: Record<JobsMapSection, number>
  collections: number
  bids: Record<SubmissionSectionKey, number>
  estimates: number
}

/** How many placed records each chip stands for, before any chip is turned off. */
export function mapPageLegendCounts(entities: readonly MapPageSectionEntity[]): MapPageLegendCounts {
  const counts: MapPageLegendCounts = {
    jobs: { waiting: 0, working: 0, readyToBill: 0, billed: 0, paid: 0 },
    collections: 0,
    bids: { unsent: 0, pending: 0, won: 0, startedOrComplete: 0, lost: 0 },
    estimates: 0,
  }
  for (const e of entities) {
    if (e.kind === 'estimate') counts.estimates += 1
    else if (e.kind === 'bid') {
      if (e.bidSection) counts.bids[e.bidSection] += 1
    } else {
      if (e.jobSection) counts.jobs[e.jobSection] += 1
      if (e.inCollections) counts.collections += 1
    }
  }
  return counts
}

// ── Per-device Cluster preference ─────────────────────────────────────────────

const CLUSTER_KEY = 'pipetooling_map_page_clustered'

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function readMapPageClustered(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(CLUSTER_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMapPageClustered(on: boolean, storage: Pick<Storage, 'setItem' | 'removeItem'> | null = safeStorage()): void {
  try {
    if (!storage) return
    if (on) storage.setItem(CLUSTER_KEY, '1')
    else storage.removeItem(CLUSTER_KEY)
  } catch {
    /* private mode / quota — the toggle just doesn't persist */
  }
}
