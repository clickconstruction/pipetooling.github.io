import { bidCellPast } from '../../lib/bids/bidCellHistory'
import { useBidCellHistoryContext } from '../../hooks/useBidHistoryCells'

/** Ask the bid's History door to open, its search set to a name (the "+N more" under a cell). */
export const BID_HISTORY_OPEN_EVENT = 'bid-history-open'
export type BidHistoryOpenDetail = { bidId: string; search: string }

/**
 * Under a typed value on a bid tab (punch list #73, PR 3): up to two earlier values, newest first,
 * in a soft line ("$9,800 · Ann · Tue"), and "+N more" that opens the History window on the row.
 * Nothing at all while the past is off, or for a cell with no past, so rows keep their height.
 */
export function BidCellPast({
  keys,
  label,
}: {
  /** The cell's keys (`priceCellKeys`, `countCellKeys`, `takeoffCellKeys`, `laborCellKeys`). */
  keys: { cellKey: string; nameKey: string | null }
  /** The row's name (a fixture, a part): what "+N more" searches the History window for. */
  label?: string | null
}) {
  const { on, index, now, bidId } = useBidCellHistoryContext()
  if (!on || !index) return null
  const past = bidCellPast(index, keys, now)
  if (!past) return null
  return (
    <div data-testid="bid-cell-past" style={{ marginTop: 2, fontSize: '0.68rem', lineHeight: 1.3, color: 'var(--text-muted)', fontStyle: past.borrowed ? 'italic' : undefined, whiteSpace: 'normal' }}>
      {past.lines.map((l) => <div key={l}>{l}</div>)}
      {past.more > 0 && bidId ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            window.dispatchEvent(new CustomEvent<BidHistoryOpenDetail>(BID_HISTORY_OPEN_EVENT, { detail: { bidId, search: label?.trim() ?? '' } }))
          }}
          style={{ padding: 0, border: 'none', background: 'none', color: 'var(--text-link)', fontSize: 'inherit', cursor: 'pointer' }}
        >
          +{past.more} more
        </button>
      ) : null}
    </div>
  )
}
