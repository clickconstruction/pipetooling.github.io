import type { CSSProperties } from 'react'
import { tileJobWords, type BoardContext, type BoardSummary, type DotTone, type SummaryDot } from '../../../lib/flows/board'
import { shortDate } from '../../../lib/gc/words'

/**
 * The tiles at the top of By step (Messages cut 4, the prototype's v1.174, `by-step-summary-mockups.html` C): one per
 * phase with the count of companies big and a dot per company, gray fine, orange over usual or lapsed, red late; Off
 * the flow; and Needs a hand, the late and the lapsed. Over usual is a watch there, never counted.
 */

const DOT: Record<DotTone, string> = { bad: 'var(--text-red-700)', warn: 'var(--text-orange-700)', '': 'var(--border-400)' }

const tile: CSSProperties = {
  flex: '1 1 150px',
  minWidth: 0,
  textAlign: 'left',
  border: '1px solid var(--border)',
  borderRadius: 10,
  padding: '0.5rem 0.75rem',
  background: 'var(--surface)',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
}

const big: CSSProperties = { display: 'block', fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.1 }
const small: CSSProperties = { display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.3 }
const dotsRow: CSSProperties = { display: 'flex', gap: 3, marginTop: 6, flexWrap: 'wrap', minHeight: 9 }

const pill = (fg: string, bg: string): CSSProperties => ({ fontSize: '0.72rem', fontWeight: 600, padding: '0.05rem 0.5rem', borderRadius: 999, color: fg, background: bg })

function Dot({ d, onPress }: { d: SummaryDot; onPress: (d: SummaryDot) => void }) {
  return (
    <button
      type="button"
      aria-label={`${d.name}: ${d.line.step.name}`}
      title={`${d.name}, ${d.line.step.name}`}
      onClick={() => onPress(d)}
      style={{ width: 10, height: 10, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: DOT[d.tone] }}
    />
  )
}

export function GcBoardTiles({
  summary,
  ctx,
  onTile,
  onDot,
  onOff,
  onHand,
}: {
  summary: BoardSummary
  ctx: Pick<BoardContext, 'flow' | 'jobs'>
  /** A phase tile: jump to its first row. */
  onTile: (stepId: string) => void
  /** A dot: that company at its step. */
  onDot: (d: SummaryDot) => void
  /** Off the flow: show them at the foot. */
  onOff: () => void
  /** Needs a hand: Follow up. */
  onHand: () => void
}) {
  const { hand } = summary
  const quiet = !hand.count && !hand.over && !hand.waiting
  return (
    <div role="group" aria-label="Where everyone stands" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
      {summary.tiles.map((t) => {
        const jobs = tileJobWords(ctx, t)
        return (
          // The tile is a box, not a button, so each dot can be its own button inside it.
          <div key={t.phase} style={{ ...tile, cursor: 'default' }}>
            <button
              type="button"
              title={`${t.words}: ${t.companies} ${t.companies === 1 ? 'company' : 'companies'}`}
              onClick={() => t.firstStepId && onTile(t.firstStepId)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
            >
              <span style={big}>{t.companies}</span>
              <span style={small}>
                {t.words}
                {jobs ? ` · ${jobs}` : ''}
              </span>
            </button>
            <span style={dotsRow}>{t.dots.length ? t.dots.map((d) => <Dot key={d.contactId} d={d} onPress={onDot} />) : <span style={small}>none</span>}</span>
          </div>
        )
      })}
      <button type="button" style={{ ...tile, color: 'var(--text-muted)' }} title="Off the flow: declined, went elsewhere, or let go" onClick={onOff}>
        <span style={big}>{summary.off.length}</span>
        <span style={small}>Off the flow</span>
        <span style={dotsRow}>
          {summary.off.length ? (
            summary.off.map((o) => (
              <span key={o.contactId} title={`${o.name}, off since ${shortDate(o.since)}: ${o.why}`} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--bg-muted)', border: '1px solid var(--border-400)' }} />
            ))
          ) : (
            <span style={small}>none</span>
          )}
        </span>
      </button>
      <button type="button" style={{ ...tile, borderColor: 'var(--border-orange)', background: 'var(--bg-orange-tint)' }} title="The late and the lapsed. Over usual is a watch, not a call." onClick={onHand}>
        <span style={big}>{hand.count}</span>
        <span style={small}>{hand.count === 1 ? 'Needs a hand today' : 'Need a hand today'}</span>
        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {hand.late > 0 && <span style={pill('var(--text-red-700)', 'var(--bg-red-tint)')}>{hand.late} late</span>}
          {hand.lapsed > 0 && <span style={pill('var(--text-orange-700)', 'var(--surface)')}>{hand.lapsed} lapsed</span>}
          {hand.over > 0 && <span style={pill('var(--text-600)', 'var(--surface)')}>{hand.over} over usual</span>}
          {hand.waiting > 0 && <span style={pill('var(--text-600)', 'var(--surface)')}>{hand.waiting} waiting</span>}
          {quiet && <span style={small}>all quiet</span>}
        </span>
      </button>
    </div>
  )
}
