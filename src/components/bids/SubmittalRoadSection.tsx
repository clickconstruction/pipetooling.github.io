import { Children, type CSSProperties, type ReactNode } from 'react'
import { btnQuiet } from './submittalTabStyles'

export type RoadStatus = 'done' | 'current' | 'waiting' | 'later'

/**
 * One stage of the road (v2.4090): the numbered dot on the rail, the title, a one-line
 * summary, and the body. A done stage folds to its summary line (click the title to
 * open it); the current stage is ringed; a later stage is dashed so a first-timer sees
 * the whole road. `anchor` is the `data-tour` the strip's pills and the walkthrough jump to.
 *
 * Each fact has one home (2026-10-05): a folded stage is its title and summary and nothing else;
 * an open stage adds its explanation and its own ?, and drops the summary when its contents
 * already say it (`summaryWhenOpen={false}`).
 */
export function RoadSection({ n, title, status, open, onToggle, onJump, anchor, summary, summaryWhenOpen = true, about, onHelp, last = false, always = false, children }: { /** False when the open step's own contents say what the summary says: the summary then shows only while the step is folded. */ summaryWhenOpen?: boolean; n: number; title: ReactNode; status: RoadStatus; open: boolean; /** The caret: fold or unfold in place. */ onToggle: () => void; /** v2.4207 · the title: open the step and ring its controls, scrolling only when they would be off screen. */ onJump: () => void; anchor: string; summary?: ReactNode; about?: string; onHelp?: () => void; last?: boolean; /** v2.4201 · never out of reach (Procure): reads strong and draws a solid box even while the journey calls it later. */ always?: boolean; children?: ReactNode }) {
  const dot: CSSProperties = {
    width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0,
    border: `2px solid ${status === 'done' ? '#16a34a' : status === 'current' ? '#2563eb' : status === 'waiting' ? '#d97706' : 'var(--border-strong)'}`,
    background: status === 'current' ? '#2563eb' : 'var(--surface)',
    color: status === 'done' ? 'var(--text-green-700)' : status === 'current' ? 'white' : status === 'waiting' ? 'var(--text-amber-700)' : 'var(--text-muted)',
  }
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden>
        <div style={dot}>{status === 'done' ? '✓' : n}</div>
        {!last ? <div style={{ flex: 1, width: 2, minHeight: 14, background: status === 'done' ? '#16a34a' : 'var(--border)' }} /> : null}
      </div>
      <section data-tour={anchor} data-testid={`road-${n}`} data-status={status} data-open={open} style={{ padding: '0.15rem 0 1rem', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.45rem', minWidth: 0 }}>
            <button type="button" onClick={onJump} style={{ ...btnQuiet, fontSize: '0.95rem', fontWeight: 700, color: status === 'later' && !always ? 'var(--text-muted)' : 'var(--text-strong)', textAlign: 'left' }} data-testid={`road-${n}-title`}>
              {n} · {title}
            </button>
            {/* The fold: a chevron big enough to read and to press (owner, 2026-10-05: the small triangles were hard to read). Up while open, down while folded. */}
            <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? 'Fold' : 'Unfold'} step ${n}`} title={open ? 'Fold this step' : 'Unfold this step'} style={{ ...btnQuiet, alignSelf: 'center', flexShrink: 0, width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text-700)' }} data-testid={`road-${n}-caret`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-dir={open ? 'up' : 'down'}>
                <path d={open ? 'M3.5 10.5 8 6l4.5 4.5' : 'M3.5 5.5 8 10l4.5-4.5'} />
              </svg>
            </button>
          </span>
          {summary && (!open || summaryWhenOpen) ? <span style={{ fontSize: '0.8125rem', color: status === 'done' ? 'var(--text-green-700)' : status === 'waiting' ? 'var(--text-amber-700)' : 'var(--text-muted)', minWidth: 0 }}>{summary}</span> : null}
        </div>
        {/* A folded step is one line: its explanation, and the ? that starts the walkthrough there, show once it is open. */}
        {about && open ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.1rem', fontSize: '0.8125rem', color: 'var(--text-muted)' }} data-testid={`road-${n}-about`}>
            <span>{about}</span>
            {onHelp ? (
              <button type="button" onClick={onHelp} title={`Walk me through step ${n}`} aria-label={`Walk me through step ${n}`} style={{ font: 'inherit', flexShrink: 0, width: 18, height: 18, borderRadius: '50%', border: '1.5px solid #3b82f6', color: 'var(--text-blue-500)', background: 'var(--surface)', fontSize: '0.66rem', fontWeight: 700, lineHeight: 1, padding: 0, cursor: 'pointer' }}>
                ?
              </button>
            ) : null}
          </div>
        ) : null}
        {open && Children.toArray(children).some(Boolean) ? (
          <div data-testid={`road-${n}-body`} style={{ marginTop: '0.5rem', border: `1px ${status === 'later' && !always ? 'dashed' : 'solid'} ${status === 'current' ? '#2563eb' : 'var(--border)'}`, boxShadow: status === 'current' ? '0 0 0 3px var(--bg-blue-tint)' : undefined, borderRadius: 8, padding: '0.6rem 0.75rem', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {children}
          </div>
        ) : null}
      </section>
    </>
  )
}
