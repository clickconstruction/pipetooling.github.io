/**
 * The three small controls of a bid mark (v2.4287):
 *
 *   - `BidMarkDot`: the circle at a picker row's left. Hidden until the row is hovered (always
 *     faintly there on a touch screen, where there is no hover), filled when the bid is marked.
 *     One click marks or clears — the way in for a mouse, beside the hold.
 *   - `MarkedBidsToggle`: *Marked · N* beside *Only my bids* on the nine tabs and in the Bid
 *     Board's tools row. On, the list shows only marked bids.
 *   - `BidMarkButton`: *Mark* / *Marked · today* in the open bid's title, so a bid can be
 *     marked without closing it.
 *
 * All three read the store directly; nothing is threaded through the nine hosts.
 */
import { useToastContext } from '../../contexts/ToastContext'
import { bidMarkButtonWords, bidMarkCount, isBidMarked } from '../../lib/bids/bidMarks'
import { setOnlyMarkedBids, toggleBidMarkNow, useBidMarks } from '../../lib/bids/bidMarksStore'

export const BID_MARK_SAVE_FAILED = 'Could not save the mark. Check your connection and try again.'

function useToggleMark() {
  const { showToast } = useToastContext()
  return (bidId: string) => {
    void toggleBidMarkNow(bidId).catch(() => showToast(BID_MARK_SAVE_FAILED, 'error'))
  }
}

export function BidMarkDot({ bidId, bidLabel }: { bidId: string; bidLabel: string }) {
  const { marks } = useBidMarks()
  const toggle = useToggleMark()
  const marked = isBidMarked(marks, bidId)
  const words = marked ? `Clear the mark on ${bidLabel}` : `Mark ${bidLabel}`
  return (
    <button
      type="button"
      className="bid-mark-dot"
      aria-pressed={marked}
      aria-label={words}
      title={words}
      onClick={(e) => {
        e.stopPropagation()
        toggle(bidId)
      }}
    >
      <span aria-hidden="true" className="bid-mark-dot__ring" />
    </button>
  )
}

export function MarkedBidsToggle({ compact = false }: { compact?: boolean }) {
  const { marks, onlyMarked } = useBidMarks()
  const count = bidMarkCount(marks)
  const title = onlyMarked ? 'Showing only the bids you marked. Press to show every bid.' : 'Show only the bids you marked. Hold a row, or click its circle, to mark it.'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={onlyMarked}
      aria-label={`Marked bids${count > 0 ? ` (${count})` : ''}`}
      title={title}
      onClick={() => setOnlyMarkedBids(!onlyMarked)}
      className="bid-mark-toggle"
      data-on={onlyMarked ? 'true' : undefined}
      style={compact ? { padding: '0.5rem 0.6rem' } : undefined}
    >
      <span aria-hidden="true" className="bid-mark-toggle__dot" />
      {compact ? null : 'Marked'}
      {count > 0 ? <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{count}</span> : null}
    </button>
  )
}

export function BidMarkButton({ bidId, now = new Date() }: { bidId: string; now?: Date }) {
  const { marks } = useBidMarks()
  const toggle = useToggleMark()
  const marked = isBidMarked(marks, bidId)
  const { label, since } = bidMarkButtonWords(marks, bidId, now)
  const title = marked ? 'Marked. Press to clear the mark.' : 'Mark this bid to find it again on every tab and on the Bid Board.'
  return (
    <button
      type="button"
      aria-pressed={marked}
      title={title}
      onClick={() => toggle(bidId)}
      className="bid-mark-toggle bid-mark-toggle--title"
      data-on={marked ? 'true' : undefined}
    >
      <span aria-hidden="true" className="bid-mark-toggle__dot" />
      {label}
      {since ? <span style={{ fontWeight: 400, opacity: 0.8 }}>{since}</span> : null}
    </button>
  )
}
