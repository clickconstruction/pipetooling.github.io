import { trackPct, type TeamWindow } from '../../../lib/teamBoard'
import { TONE, type TeamTone } from './teamBoardStyles'

/**
 * The 6 am → midnight axis on a chip: outlined bands are dispatch blocks, filled
 * bars are clock sessions. Ticks at 8a / noon / 4p / 8p.
 */
export function TeamTimeTrack({ plan, clock, tone, width }: { plan: TeamWindow[]; clock: TeamWindow[]; tone: TeamTone; width?: number | string }) {
  const t = TONE[tone]
  return (
    <span aria-hidden style={{ position: 'relative', display: 'block', height: 10, width: width ?? '100%', background: 'var(--bg-200)', borderRadius: 2, overflow: 'hidden' }}>
      {[8, 12, 16, 20].map((h) => (
        <span key={h} style={{ position: 'absolute', top: 0, left: `${trackPct(h)}%`, width: 1, height: '100%', background: 'var(--border)' }} />
      ))}
      {plan.map((w, i) => (
        <span key={`p${i}`} style={{ position: 'absolute', top: 0, height: '100%', left: `${trackPct(w.start)}%`, width: `${trackPct(w.end) - trackPct(w.start)}%`, border: `1px solid ${tone === 'miss' ? t.bar : 'var(--border-strong)'}`, borderRadius: 2, boxSizing: 'border-box' }} />
      ))}
      {clock.map((w, i) => (
        <span key={`c${i}`} style={{ position: 'absolute', top: 2, height: 6, left: `${trackPct(w.start)}%`, width: `${Math.max(0.8, trackPct(w.end) - trackPct(w.start))}%`, borderRadius: 2, background: t.bar }} />
      ))}
    </span>
  )
}
