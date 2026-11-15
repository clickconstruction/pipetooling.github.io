/**
 * *Can't be scored* (team scorecard, punch list #360, PR 2): the chip on a Bid Board row whose priced
 * bid the Scores tab would hold, with the reason in its hover. On a bid still on the desk it is a
 * press that opens the Labor tab, where the hours are filled; on a bid that went out it only says so,
 * since the margin was kept at send.
 */
import type { CSSProperties } from 'react'
import { scoreHoldTitle, type ScoreReadiness } from '../../lib/scorecard/scoreReadiness'

const CHIP: CSSProperties = { display: 'inline-block', font: 'inherit', fontSize: '0.7rem', fontWeight: 600, padding: '0.08rem 0.5rem', borderRadius: 999, background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)', whiteSpace: 'nowrap', lineHeight: 1.4 }

export default function BidScoreHoldChip({ hold, onOpenLabor }: { hold: Extract<ScoreReadiness, { kind: 'hold' }> | null | undefined; onOpenLabor?: (() => void) | null }) {
  if (!hold) return null
  const title = scoreHoldTitle(hold)
  if (onOpenLabor) {
    return (
      <button
        type="button"
        data-testid="bid-score-hold-chip"
        title={title}
        aria-label={`${hold.chip}. ${title} Open Labor.`}
        onClick={(e) => {
          e.stopPropagation()
          onOpenLabor()
        }}
        style={{ ...CHIP, cursor: 'pointer' }}
      >
        {hold.chip}
      </button>
    )
  }
  return (
    <span data-testid="bid-score-hold-chip" title={title} style={CHIP}>
      {hold.chip}
    </span>
  )
}
