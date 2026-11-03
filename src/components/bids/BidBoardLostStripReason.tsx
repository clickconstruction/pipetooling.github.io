/**
 * The Lost pile's "Why did we lose?" strip (v2.2943; its own component since v2.6409), shared by
 * the table row and the phone card. It reads `lossReasonState` over the bid AND its GC packets:
 * a bid lost GC by GC with a reason on every card reads those reasons, one line per GC, and asks
 * nothing (BP391, 2026-11-03: GC lost the project with Structura, Price too high with PlanHub,
 * and the strip still asked *Add why*). A loss with no reason anywhere nudges and carries the six
 * chips right here — one tap writes `bids.loss_category` (the Lost summary modal's write) without
 * opening anything; when some GCs have a reason and one does not, the nudge names it.
 */
import { BidLossCategoryChips } from './BidLossCategoryChips'
import {
  LOSS_UNCATEGORIZED_NUDGE,
  lossReasonState,
  suggestLossCategoryFromNote,
  type BidLossCategoryKey,
  type LossReasonPacketLike,
} from '../../lib/bidLossCategories'

export type BidBoardLostStripReasonProps = {
  bid: { id: string; loss_category?: string | null; loss_reason?: string | null }
  /** The bid's GC packets (`gcPacketsByBid[bid.id]`); undefined on a bid with none. */
  packets?: ReadonlyArray<LossReasonPacketLike>
  /** A chip's write is in flight. */
  saving: boolean
  onSelect: (key: BidLossCategoryKey) => void
}

export function BidBoardLostStripReason({ bid, packets, saving, onSelect }: BidBoardLostStripReasonProps) {
  const s = lossReasonState(bid, packets)
  const perGc = s.source === 'packets' || (s.source === 'none' && s.lines.length > 0)
  return (
    <>
      <span style={{ fontWeight: 600, color: 'var(--text-strong)' }}>Why did we lose? </span>
      {perGc ? (
        <span data-testid="lost-strip-gc-lines" style={{ color: 'var(--text-700)' }}>
          {s.lines.map((l, i) => (
            <span key={l.gcName} style={{ display: i === 0 ? 'inline' : 'block', paddingLeft: i === 0 ? 0 : '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{l.gcName}</span> {l.label}
              {l.note ? <span style={{ color: 'var(--text-muted)' }}> — {l.note}</span> : null}
            </span>
          ))}
        </span>
      ) : (
        <span style={{ color: s.categorized || s.note ? 'var(--text-700)' : 'var(--text-faint)' }}>
          {s.categorized ? `${s.label}${s.note ? ` — ${s.note}` : ''}` : s.note || '—'}
        </span>
      )}
      {!s.categorized ? (
        <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.4rem', cursor: 'default' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-amber-700)', marginBottom: '0.3rem' }}>
            {LOSS_UNCATEGORIZED_NUDGE}
            {s.missing.length > 0 ? ` Still no reason from ${s.missing.join(', ')}.` : ''}
          </div>
          <BidLossCategoryChips
            value={null}
            size="sm"
            disabled={saving}
            suggestedKey={suggestLossCategoryFromNote(s.note)}
            suggestedHint="suggested from the note — click to confirm"
            onSelect={onSelect}
          />
        </div>
      ) : null}
    </>
  )
}
