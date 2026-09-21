import type { CSSProperties, ReactNode } from 'react'
import type { GcNoticeStep, GcNoticeStepKey } from '../../lib/jobs/gcOnNoticeSteps'

/**
 * Put a GC on notice — what makes the four steps read as four steps (v2.3665):
 * the step bar pinned to the top of the scrolling body (number, name, live
 * status; lights the step in view, jumps on click), and the shell each step
 * sits in (a numbered disc on a connecting line, a real title, one sentence,
 * a status pill). The statuses come from `buildGcNoticeSteps`.
 */

/** Literal fills: a white label sits on them in both themes (v2.3656). */
const DONE_FILL = '#166534'
const CURRENT = '#2563eb'
const ATTENTION = '#d97706'

function discStyle(step: GcNoticeStep, current: boolean, size: number): CSSProperties {
  const done = step.tone === 'done'
  const ring = done ? DONE_FILL : current ? CURRENT : step.tone === 'attention' ? ATTENTION : 'var(--border-strong)'
  return {
    width: size,
    height: size,
    flex: 'none',
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: size >= 30 ? '0.875rem' : '0.8125rem',
    fontWeight: 800,
    fontVariantNumeric: 'tabular-nums',
    border: `2px solid ${ring}`,
    background: done ? DONE_FILL : 'var(--surface)',
    color: done ? '#fff' : current ? 'var(--text-link)' : step.tone === 'attention' ? 'var(--text-amber-800)' : 'var(--text-700)',
  }
}

export function GcNoticeStepPill({ tone, children, testId }: { tone: GcNoticeStep['tone']; children: ReactNode; testId?: string }) {
  const c =
    tone === 'done'
      ? { bg: 'var(--bg-green-tint)', fg: 'var(--text-green-800)', bd: 'var(--border-green)' }
      : tone === 'attention'
        ? { bg: 'var(--bg-amber-tint)', fg: 'var(--text-amber-800)', bd: 'var(--border-amber)' }
        : { bg: 'var(--bg-muted)', fg: 'var(--text-700)', bd: 'var(--border)' }
  return (
    <span data-testid={testId} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', background: c.bg, color: c.fg, border: `1px solid ${c.bd}` }}>
      {children}
    </span>
  )
}

export function GcNoticeStepBar({ steps, current, onJump, compact }: { steps: ReadonlyArray<GcNoticeStep>; current: GcNoticeStepKey; onJump: (key: GcNoticeStepKey) => void; compact: boolean }) {
  return (
    <nav aria-label="Steps" data-gc-notice-stepbar style={{ position: 'sticky', top: 0, zIndex: 2, display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: compact ? '0 0.25rem' : '0 0.75rem' }}>
      {steps.map((st) => {
        const on = st.key === current
        return (
          <button
            key={st.key}
            type="button"
            onClick={() => onJump(st.key)}
            aria-current={on ? 'step' : undefined}
            title={`${st.name} — ${st.status}`}
            data-testid="gc-notice-stepbar-step"
            data-tone={st.tone}
            style={{ display: 'flex', flexDirection: compact ? 'column' : 'row', alignItems: 'center', gap: compact ? 3 : 9, textAlign: compact ? 'center' : 'left', padding: '0.5rem 0.5rem 0.4rem', background: 'none', border: 'none', borderBottom: `3px solid ${on ? CURRENT : 'transparent'}`, cursor: 'pointer', font: 'inherit', minWidth: 0 }}
          >
            <span style={discStyle(st, on, 26)} aria-hidden="true">{st.tone === 'done' ? '✓' : st.n}</span>
            <span style={{ display: 'grid', minWidth: 0 }}>
              <span style={{ fontSize: compact ? '0.6875rem' : '0.8125rem', fontWeight: 700, color: on ? 'var(--text-base)' : 'var(--text-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</span>
              {compact ? null : <span style={{ fontSize: '0.72rem', color: st.tone === 'attention' ? 'var(--text-amber-800)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.status}</span>}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

export function GcNoticeStepSection({ step, current, title, description, right, last, children }: { step: GcNoticeStep; current: boolean; title: string; description: ReactNode; right?: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <section data-gc-notice-step={step.key} data-tone={step.tone} aria-label={`Step ${step.n} · ${title}`} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', columnGap: '0.85rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }} aria-hidden="true">
        <span style={discStyle(step, current, 30)}>{step.tone === 'done' ? '✓' : step.n}</span>
        {last ? null : <span style={{ flex: 1, width: 2, background: 'var(--border)', margin: '4px 0' }} />}
      </div>
      <div style={{ display: 'grid', gap: '0.6rem', minWidth: 0, paddingBottom: last ? '0.25rem' : '1.6rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.4rem 1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, lineHeight: '30px', letterSpacing: '-0.01em' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '72ch' }}>{description}</p>
          </div>
          {right ? <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>{right}</div> : null}
        </div>
        {children}
      </div>
    </section>
  )
}
