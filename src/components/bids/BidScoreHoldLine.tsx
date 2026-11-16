/**
 * The line that says a priced bid cannot be scored (team scorecard, punch list #360, PR 2), under the
 * Pricing workbench's strip and at the top of its send window: the reason, what to do, and the door
 * to the Labor tab while the bid is still on the desk. It never stops a send: the bid may go out,
 * and the Scores tab will hold it with the same words.
 */
import { SCORE_HOLD_CHIP, type ScoreReadiness } from '../../lib/scorecard/scoreReadiness'

export default function BidScoreHoldLine({ hold, onOpenLabor, style }: { hold: Extract<ScoreReadiness, { kind: 'hold' }> | null | undefined; onOpenLabor?: (() => void) | null; style?: React.CSSProperties }) {
  if (!hold) return null
  return (
    <div
      data-testid="bid-score-hold-line"
      role="note"
      style={{ display: 'flex', alignItems: 'baseline', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.45rem', border: '1px solid var(--border-amber)', background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', borderRadius: 8, padding: '0.35rem 0.7rem', fontSize: '0.78rem', ...style }}
    >
      <b>{SCORE_HOLD_CHIP}.</b>
      <span>
        {hold.words} {hold.fix}
      </span>
      {onOpenLabor ? (
        <button
          type="button"
          onClick={onOpenLabor}
          style={{ font: 'inherit', fontSize: '0.78rem', fontWeight: 700, border: 'none', background: 'none', color: 'var(--text-link)', cursor: 'pointer', display: 'inline-block', padding: '13px 0', margin: '-13px 0', textDecoration: 'underline', textUnderlineOffset: 2 }}
        >
          Open Labor
        </button>
      ) : null}
    </div>
  )
}
