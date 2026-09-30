/**
 * Standard-row bid picker list — replaces the two-column `Project | Bid Date`
 * tables on the no-bid-selected workflow tabs (Counts, Takeoffs, Labor,
 * Pricing, Cover Letter, Submittals, Change Order, RFI, Lien Release) with the
 * app-wide search presentation: trade pill + plain B number + project - address,
 * and the outcome chip · $value · due/sent date rail.
 *
 * Rows sit under the Bid Board's headings (`groupBidsForPicker`), in the board's
 * order, each heading carrying its count: Unsent / Working Bids, Not yet won or
 * lost, Won, Started or Complete, Lost, and a trailing Archived (Unsent/Working)
 * for bids put away from the board. A heading folds its group; Lost and Archived
 * start folded, and the folds are one per-browser choice shared by every tab
 * (localStorage, like the sort view). While the host is searching every group is
 * open and the empty ones are gone, so a match is never behind a fold.
 *
 * Rows are already-loaded `BidWithBuilder`s, so the evidence is built locally
 * from the row itself — no fetch. Selection stays the host's `onSelectBid`.
 * Rows render in the user's picker sort view (`BidPickerSortToggle` store)
 * inside each group, so hosts pass bids unsorted and every tab stays consistent.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidSearchEvidence } from '../../lib/jobSearchEvidence'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import {
  groupBidsForPicker,
  isBidPickerGroupFolded,
  normalizeBidPickerFolds,
  type BidPickerFolds,
  type BidPickerGroupKey,
} from '../../lib/bidPickerGroups'
import { useBidPickerSortView } from './BidPickerSortToggle'
import { UnifiedSearchResultRow } from '../search/UnifiedSearchResultRow'
import type { UnifiedSearchResult } from '../../utils/unifiedJobBidSearch'

export function bidWithBuilderToUnified(b: BidWithBuilder): Extract<UnifiedSearchResult, { source: 'bid' }> {
  return {
    source: 'bid',
    id: b.id,
    bid_number: (b.bid_number ?? '').trim(),
    project_name: bidDisplayName(b) || '',
    address: b.address ?? '',
    customer_name: b.customers?.name ?? b.bids_gc_builders?.name ?? '',
    service_type_id: b.service_type_id ?? null,
    service_type_name: b.service_type?.name ?? null,
  }
}

export function bidWithBuilderEvidence(b: BidWithBuilder): BidSearchEvidence {
  return {
    bidValue: b.bid_value === null || b.bid_value === undefined ? null : Number(b.bid_value),
    winLoss: b.outcome ?? null,
    dateSent: b.bid_date_sent ?? null,
    dueDate: b.bid_due_date ?? null,
  }
}

// ---- fold store: one per-browser choice, shared by every tab (same shape as the sort view) ----

const FOLDS_STORAGE_KEY = 'bidPickerFolds'

function readStoredFolds(): BidPickerFolds {
  try {
    const raw = window.localStorage.getItem(FOLDS_STORAGE_KEY)
    return raw ? normalizeBidPickerFolds(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

const EMPTY_FOLDS: BidPickerFolds = {}
let currentFolds: BidPickerFolds = typeof window === 'undefined' ? EMPTY_FOLDS : readStoredFolds()
const foldListeners = new Set<() => void>()

function subscribeFolds(listener: () => void): () => void {
  foldListeners.add(listener)
  return () => foldListeners.delete(listener)
}

export function setBidPickerGroupFolded(key: BidPickerGroupKey, folded: boolean) {
  currentFolds = { ...currentFolds, [key]: folded }
  try {
    window.localStorage.setItem(FOLDS_STORAGE_KEY, JSON.stringify(currentFolds))
  } catch {
    // Private-mode storage failures just lose persistence, not the session's choice.
  }
  for (const l of foldListeners) l()
}

export function useBidPickerFolds(): BidPickerFolds {
  return useSyncExternalStore(subscribeFolds, () => currentFolds, () => EMPTY_FOLDS)
}

export function BidPickerStandardList({
  bids,
  prefixMap,
  onSelectBid,
  emptyMessage,
  countBadges,
  searching = false,
}: {
  bids: BidWithBuilder[]
  prefixMap: LedgerPrefixMap
  onSelectBid: (bid: BidWithBuilder) => void
  /** Rendered instead of the list when `bids` is empty; omit to render nothing. */
  emptyMessage?: string | null
  /** Bid id → count-row tally. When provided (the Counts tab), every row leads
      with its number in a subtle left column — a dim "—" for bids with nothing
      counted yet, so "which bids still need counting" reads at a glance. */
  countBadges?: Record<string, number> | null
  /** True while the host's search box has text: every group is open so a match is never behind a fold. */
  searching?: boolean
}) {
  const sortView = useBidPickerSortView()
  const folds = useBidPickerFolds()
  const groups = useMemo(() => groupBidsForPicker(bids, sortView), [bids, sortView])
  if (bids.length === 0) {
    return emptyMessage ? (
      <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{emptyMessage}</p>
    ) : null
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--surface)' }}>
      {groups.map((group, gi) => {
        const folded = !searching && isBidPickerGroupFolded(folds, group.key)
        const sectionId = `bid-picker-group-${group.key}`
        return (
          <section key={group.key} aria-labelledby={`${sectionId}-heading`}>
            <button
              type="button"
              id={`${sectionId}-heading`}
              aria-expanded={!folded}
              aria-controls={sectionId}
              title={searching ? undefined : folded ? `Show ${group.label}` : `Hide ${group.label}`}
              onClick={() => {
                if (searching) return
                setBidPickerGroupFolded(group.key, !folded)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                border: 'none',
                borderTop: gi === 0 ? 'none' : '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-subtle)',
                cursor: searching ? 'default' : 'pointer',
                font: 'inherit',
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--text-strong)',
              }}
            >
              <span>{group.label}</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>({group.bids.length})</span>
              {!searching && (
                <span aria-hidden="true" style={{ marginLeft: 'auto', fontSize: '0.7rem', color: 'var(--text-faint)' }}>
                  {folded ? '▶' : '▼'}
                </span>
              )}
            </button>
            <div id={sectionId} hidden={folded}>
              {group.bids.map((bid) => (
                <button
                  key={bid.id}
                  type="button"
                  onClick={() => onSelectBid(bid)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-subtle)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface)'
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.55rem 0.75rem',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--surface)',
                    cursor: 'pointer',
                    font: 'inherit',
                    fontSize: '0.875rem',
                    color: 'var(--text-strong)',
                  }}
                >
                  {countBadges != null ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {(() => {
                        const n = countBadges[bid.id] ?? 0
                        return (
                          <span
                            title={n > 0 ? `${n} fixture${n === 1 ? ' or tie-in' : 's & tie-ins'} counted` : 'No counts yet'}
                            style={{
                              flex: '0 0 2rem',
                              textAlign: 'right',
                              fontSize: '0.78rem',
                              fontVariantNumeric: 'tabular-nums',
                              color: n > 0 ? 'var(--text-muted)' : 'var(--text-faint)',
                            }}
                          >
                            {n > 0 ? n : '—'}
                          </span>
                        )
                      })()}
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <UnifiedSearchResultRow
                          result={bidWithBuilderToUnified(bid)}
                          prefixMap={prefixMap}
                          bidEvidence={bidWithBuilderEvidence(bid)}
                        />
                      </span>
                    </span>
                  ) : (
                    <UnifiedSearchResultRow
                      result={bidWithBuilderToUnified(bid)}
                      prefixMap={prefixMap}
                      bidEvidence={bidWithBuilderEvidence(bid)}
                    />
                  )}
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
