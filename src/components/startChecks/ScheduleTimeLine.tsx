/**
 * The Schedule look on a line of time (punch list #382, PR 11): one row a stage ahead. A bar for our days in the
 * stage's colour, a diamond on the day they say ready, a hollow diamond on a day they gave before, a dotted line on
 * the day we decide, and the days they moved in red. Each row is one picture with its sentence as its name, so a
 * reader that cannot see the line hears the same facts. The places are `timeLine`'s shares of the span.
 */
import type { CSSProperties } from 'react'
import { TIME_LINE_WORDS as W, type TimeLine } from '../../lib/startChecks/timeLine'

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: '0.75rem' }
const diamond = (at: number, hollow: boolean): CSSProperties => ({ position: 'absolute', left: `${at}%`, top: '50%', width: 10, height: 10, transform: 'translate(-50%, -50%) rotate(45deg)', border: '2px solid var(--text-strong)', background: hollow ? 'var(--surface)' : 'var(--text-strong)', boxSizing: 'border-box' })

export function ScheduleTimeLine({ line }: { line: TimeLine }) {
  return (
    <div data-schedule-time-line style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem 0.75rem', overflowX: 'auto' }}>
      <div style={{ minWidth: 520 }}>
        {/* The week marks, over the track's own column. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 11rem) 1fr', gap: 10 }}>
          <span />
          <div aria-hidden style={{ position: 'relative', height: 18 }}>
            {line.ticks.map((t) => (
              <span key={t.at} style={{ position: 'absolute', left: `${t.at}%`, transform: t.at > 92 ? 'translateX(-100%)' : undefined, whiteSpace: 'nowrap', ...muted }}>
                {t.label}
              </span>
            ))}
          </div>
        </div>
        {line.rows.map((r) => (
          <div key={r.id} data-time-line-row={r.id} data-light={r.light} style={{ display: 'grid', gridTemplateColumns: 'minmax(7rem, 11rem) 1fr', gap: 10, alignItems: 'center', minHeight: 30 }}>
            <div style={{ minWidth: 0, fontSize: '0.8125rem', lineHeight: 1.25 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ ...muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.job}
                {r.moved ? (
                  <span className="scLineMoved">
                    {r.job ? ' · ' : ''}
                    {W.moved(r.moved)}
                  </span>
                ) : null}
              </div>
            </div>
            <div role="img" aria-label={r.words} style={{ position: 'relative', height: 26, borderLeft: '1px solid var(--border)', borderRight: '1px solid var(--border)' }}>
              {line.today != null ? <span style={{ position: 'absolute', left: `${line.today}%`, top: 0, bottom: 0, width: 1, background: 'var(--border-strong)' }} /> : null}
              {r.bar ? <span className="scLineBar" data-light={r.light} style={{ position: 'absolute', left: `${r.bar.from}%`, width: `${Math.max(0.8, r.bar.to - r.bar.from)}%`, top: 6, bottom: 6, borderRadius: 4 }} /> : null}
              {r.decide != null ? <span style={{ position: 'absolute', left: `${r.decide}%`, top: 0, bottom: 0, borderLeft: '2px dotted var(--text-strong)' }} /> : null}
              {r.before.map((at, i) => (
                <span key={i} style={diamond(at, true)} />
              ))}
              {r.said != null ? <span style={diamond(r.said, false)} /> : null}
            </div>
          </div>
        ))}
        <div aria-hidden style={{ display: 'flex', gap: '4px 14px', flexWrap: 'wrap', marginTop: 8, ...muted }}>
          <span>
            <span className="scLineBar" data-light="green" style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 3, verticalAlign: 'middle' }} /> {W.legend[0]}
          </span>
          <span>
            <span style={{ ...diamond(0, false), position: 'static', display: 'inline-block', transform: 'rotate(45deg)', margin: '0 4px', verticalAlign: 'middle' }} /> {W.legend[1]}
          </span>
          <span>
            <span style={{ ...diamond(0, true), position: 'static', display: 'inline-block', transform: 'rotate(45deg)', margin: '0 4px', verticalAlign: 'middle' }} /> {W.legend[2]}
          </span>
          <span>
            <span style={{ display: 'inline-block', height: 12, borderLeft: '2px dotted var(--text-strong)', margin: '0 6px', verticalAlign: 'middle' }} /> {W.legend[3]}
          </span>
        </div>
      </div>
    </div>
  )
}

export default ScheduleTimeLine
