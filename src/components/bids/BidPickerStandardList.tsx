/**
 * Standard-row bid picker list — replaces the two-column `Project | Bid Date`
 * tables on the no-bid-selected workflow tabs (Counts, Takeoffs, Labor,
 * Pricing, Cover Letter, Change Order, RFI, Lien Release) with the app-wide
 * search presentation: trade pill + plain B number + project - address, and
 * the outcome chip · $value · due/sent date rail.
 *
 * Rows are already-loaded `BidWithBuilder`s, so the evidence is built locally
 * from the row itself — no fetch. Selection stays the host's `onSelectBid`.
 * Rows render in the user's picker sort view (`BidPickerSortToggle` store),
 * so hosts pass bids unsorted and every tab stays consistent.
 */
import { useMemo } from 'react'
import type { BidWithBuilder } from '../../types/bidWithBuilder'
import type { LedgerPrefixMap } from '../../lib/ledgerDisplayPrefixes'
import type { BidSearchEvidence } from '../../lib/jobSearchEvidence'
import { bidDisplayName } from '../../lib/bids/bidFormatting'
import { sortBidsForPicker } from '../../lib/bidPickerSort'
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

export function BidPickerStandardList({
  bids,
  prefixMap,
  onSelectBid,
  emptyMessage,
  countBadges,
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
}) {
  const sortView = useBidPickerSortView()
  const sortedBids = useMemo(() => sortBidsForPicker(bids, sortView), [bids, sortView])
  if (bids.length === 0) {
    return emptyMessage ? (
      <p style={{ margin: 0, padding: '0.75rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{emptyMessage}</p>
    ) : null
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden', background: 'var(--surface)' }}>
      {sortedBids.map((bid) => (
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
  )
}
