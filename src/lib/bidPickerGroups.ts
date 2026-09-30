/**
 * Grouping for the no-bid-selected picker on the nine bid workflow tabs (Counts,
 * Takeoffs, Labor, Pricing, Cover Letter, Submittals, RFI, Change Order, Lien
 * Release): the rows sit under the Bid Board's own headings, in the board's order,
 * each with its count — so "which pile is this bid in" reads the same on every
 * Bids surface.
 *
 * The pile is `getSubmissionSectionKey` (the board's rule, `bidSentCounts.ts`
 * rule 3), with one addition the board makes in its own render: an unsent bid
 * archived off the working board leaves Unsent / Working and sits in its own
 * trailing group, named as the board's Archived window names it. The user's
 * picker sort view orders the rows inside each group; the headings never move.
 *
 * Pure — no React, no Supabase.
 */
import { getSubmissionSectionKey, type SubmissionSectionKey } from './bids/submissionSections'
import { compareBidsForPicker, type BidPickerSortBid, type BidPickerSortView } from './bidPickerSort'

export type BidPickerGroupKey = SubmissionSectionKey | 'archived'

export type BidPickerGroupBid = BidPickerSortBid & {
  outcome: string | null
  working_board_archived_at?: string | null
}

export const BID_PICKER_GROUPS: ReadonlyArray<{ key: BidPickerGroupKey; label: string }> = [
  { key: 'unsent', label: 'Unsent / Working Bids' },
  { key: 'pending', label: 'Not yet won or lost' },
  { key: 'won', label: 'Won' },
  { key: 'startedOrComplete', label: 'Started or Complete' },
  { key: 'lost', label: 'Lost' },
  { key: 'archived', label: 'Archived (Unsent/Working)' },
]

/** Groups that start folded: the big Lost pile and the bids put away from the board. */
export const BID_PICKER_GROUPS_FOLDED_BY_DEFAULT: ReadonlyArray<BidPickerGroupKey> = ['lost', 'archived']

export function bidPickerGroupKey(bid: Pick<BidPickerGroupBid, 'outcome' | 'bid_date_sent' | 'working_board_archived_at'>): BidPickerGroupKey {
  const key = getSubmissionSectionKey(bid) ?? 'unsent'
  if (key === 'unsent' && bid.working_board_archived_at) return 'archived'
  return key
}

export type BidPickerGroup<T> = { key: BidPickerGroupKey; label: string; bids: T[] }

/** The groups in board order, empty ones dropped, rows sorted by `view` inside each. */
export function groupBidsForPicker<T extends BidPickerGroupBid>(bids: ReadonlyArray<T>, view: BidPickerSortView): BidPickerGroup<T>[] {
  const byKey = new Map<BidPickerGroupKey, T[]>()
  for (const bid of bids) {
    const key = bidPickerGroupKey(bid)
    const list = byKey.get(key)
    if (list) list.push(bid)
    else byKey.set(key, [bid])
  }
  const out: BidPickerGroup<T>[] = []
  for (const g of BID_PICKER_GROUPS) {
    const list = byKey.get(g.key)
    if (!list || list.length === 0) continue
    out.push({ key: g.key, label: g.label, bids: [...list].sort((a, b) => compareBidsForPicker(view, a, b)) })
  }
  return out
}

/** Per-group fold state: `true` = folded. Missing keys read the default. */
export type BidPickerFolds = Partial<Record<BidPickerGroupKey, boolean>>

export function isBidPickerGroupFolded(folds: BidPickerFolds, key: BidPickerGroupKey): boolean {
  const stored = folds[key]
  if (typeof stored === 'boolean') return stored
  return BID_PICKER_GROUPS_FOLDED_BY_DEFAULT.includes(key)
}

/** Reads a stored fold map back defensively (localStorage may hold anything). */
export function normalizeBidPickerFolds(raw: unknown): BidPickerFolds {
  if (!raw || typeof raw !== 'object') return {}
  const out: BidPickerFolds = {}
  for (const g of BID_PICKER_GROUPS) {
    const v = (raw as Record<string, unknown>)[g.key]
    if (typeof v === 'boolean') out[g.key] = v
  }
  return out
}
