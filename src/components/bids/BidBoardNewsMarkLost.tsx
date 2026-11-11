import type { GcPacket } from '../../lib/bids/gcPackets'
import type { BidRoomStateSummary } from '../../lib/bids/bidRoomState'
import type { BidBoardJobLink } from '../../lib/bids/bidBoardJobLinks'
import { BidBoardGcLines, gcRowsWorthShowing } from './BidBoardGcRows'
import { BidLostQuickPopover } from './BidLostQuickPopover'

/**
 * Mark lost… on a permit news line (punch list #307): the outcome the board already has, drawn
 * under the line. A bid whose row lists its GCs gets the row's own lines (`BidBoardGcLines`),
 * where a GC's state takes lost and the bid rolls up. Any other bid gets the quick lost capture
 * (`BidLostQuickPopover`), which writes the bid. Neither writes until the person picks in it,
 * and the news never picks.
 */
export const NEWS_LOST_PER_GC_TITLE = 'Lost with which GC?'
export const NEWS_LOST_PER_GC_HINT = 'Press the state beside a GC’s name, then lost. Nothing is saved until you pick.'

export function BidBoardNewsMarkLost({
  bid,
  bidLabel,
  packets,
  gcNoteCounts,
  roomStates,
  jobLink,
  onChanged,
  onClose,
}: {
  bid: { id: string; outcome?: string | null; loss_reason?: string | null; loss_category?: string | null }
  bidLabel?: string
  /** The bid's GC packets, as the row reads them. */
  packets: GcPacket[] | undefined
  gcNoteCounts?: Record<string, number>
  roomStates?: Record<string, BidRoomStateSummary>
  jobLink?: BidBoardJobLink | null
  /** A save landed: the board reads its bids again. */
  onChanged: () => void
  onClose: () => void
}) {
  if (!gcRowsWorthShowing(packets)) return <BidLostQuickPopover bid={bid} onSaved={onChanged} onClose={onClose} />
  return (
    <div
      role="group"
      aria-label={NEWS_LOST_PER_GC_TITLE}
      style={{ border: '1px solid var(--border-strong)', background: 'var(--surface)', borderRadius: 8, padding: '0.6rem 0.75rem', margin: '0.25rem 0 0.4rem', maxWidth: '34rem' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        }
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-700)' }}>{NEWS_LOST_PER_GC_TITLE}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0.45rem' }}>{NEWS_LOST_PER_GC_HINT}</div>
      <BidBoardGcLines bidId={bid.id} bidLabel={bidLabel} bidOutcome={bid.outcome ?? null} packets={packets ?? []} onChanged={onChanged} gcNoteCounts={gcNoteCounts} roomStates={roomStates} jobLink={jobLink} />
      <div style={{ display: 'flex', marginTop: '0.45rem' }}>
        <button type="button" onClick={onClose} style={{ font: 'inherit', fontSize: '0.72rem', padding: 0, border: 'none', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 'auto' }}>
          Close
        </button>
      </div>
    </div>
  )
}
