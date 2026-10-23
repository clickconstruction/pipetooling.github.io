import type { Bid } from '../../types/bids'
import { LET_ROBOT_BACK_IN_LABEL, ROBOT_LEFT_SHEET_SENTENCES, robotLeftLabel } from '../../lib/bids/robotLeftToYou'
import { RobotLeftMark } from './RobotLeftMark'

type RobotLeftToYouSheetProps = {
  /** The bid left to a person; null = closed. */
  bid: Bid | null
  onClose: () => void
  /** Clears `bids.robot_opt_out`; the next round may claim the bid. */
  onLetBackIn: (bid: Bid) => void
}

/**
 * The tap on the left-to-you mark (v2.5751, punch list #142): what the mark means, what the
 * one button does, and that button. A bid reaches this state from Leave this one to me on the
 * status sheet or the form's tick; before this sheet the only way back was the Edit tab.
 */
export function RobotLeftToYouSheet({ bid, onClose, onLetBackIn }: RobotLeftToYouSheetProps) {
  if (!bid) return null
  const [left, back] = ROBOT_LEFT_SHEET_SENTENCES
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="robot-left-title"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1005, padding: 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 8, maxWidth: 460, width: '100%', padding: '1.1rem 1.25rem', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', maxHeight: 'min(85vh, 100%)', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.9rem' }}>
          <RobotLeftMark size={34} />
          <div style={{ minWidth: 0 }}>
            <h2 id="robot-left-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Left to you</h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} data-testid="robot-left-label">{robotLeftLabel(bid)}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.875rem', color: 'var(--text-base)', margin: '0 0 1rem' }} data-testid="robot-left-words">
          <p style={{ margin: 0 }}>{left}</p>
          <p style={{ margin: 0 }}>{back}</p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => onLetBackIn(bid)}
            style={{ padding: '0.45rem 0.85rem', border: 'none', borderRadius: 4, background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}
          >
            {LET_ROBOT_BACK_IN_LABEL}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ marginLeft: 'auto', padding: '0.45rem 0.85rem', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)', color: 'inherit', cursor: 'pointer', font: 'inherit', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
