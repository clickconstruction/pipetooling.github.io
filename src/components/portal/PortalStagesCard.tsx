/**
 * The GC's stage sequence, in the company's voice (Stage Plan PR 4): one
 * headline, the shared Order stages as numbered steps — green check when
 * done, filled while the crew is on site, hollow ahead — the live step's
 * progress in words, one ask slot on the next step, and the shared Any-time
 * rows under "Also on this job". Never a name: the `GcView` it renders has
 * no field for one. Paper palette; the office drawer and the customer
 * portal both draw it.
 */
import type { CSSProperties, ReactNode } from 'react'
import type { GcStep, GcView } from '../../lib/jobs/stagePlan'
import { CARD, COPPER, FAINT, HAIR, INK, MUTED, PAPER, PAPER_GREEN } from '../../lib/portal/portalTheme'

type PortalStagesCardProps = {
  view: GcView
  jobLabel: string
  jobAddress?: string | null
  /** The one interactive slot: rendered under the `next` step (the ask). */
  askSlot?: (step: GcStep) => ReactNode
  /** Drop the outer card chrome when the caller already draws one. */
  bare?: boolean
}

const LINE_COLOR = '#c9d2dc'

function Dot({ step }: { step: GcStep }) {
  const base: CSSProperties = { width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, boxSizing: 'border-box', background: CARD }
  if (step.state === 'done') return <span aria-label={`Stage ${step.number}, done`} style={{ ...base, background: PAPER_GREEN, color: '#fff' }}>✓</span>
  if (step.state === 'now') return <span aria-label={`Stage ${step.number}, on site now`} style={{ ...base, background: INK, color: '#fff' }}>{step.number}</span>
  return <span aria-label={`Stage ${step.number}`} style={{ ...base, border: `1.5px solid ${step.state === 'next' ? LINE_COLOR : HAIR}`, color: step.state === 'next' ? MUTED : FAINT }}>{step.number}</span>
}

export function PortalStagesCard({ view, jobLabel, jobAddress = null, askSlot, bare = false }: PortalStagesCardProps) {
  const wrap: CSSProperties = bare ? {} : { background: CARD, border: `1px solid ${HAIR}`, padding: '1rem 1.3rem' }
  return (
    <div data-testid="portal-stages-card" style={{ ...wrap, color: INK }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Where the job is</div>
      <div style={{ fontWeight: 700, fontSize: 14 }}>
        {jobLabel}
        {jobAddress ? <span style={{ color: MUTED, fontWeight: 400 }}> · {jobAddress}</span> : null}
      </div>
      {view.headline ? (
        <div data-testid="portal-stages-headline" style={{ color: MUTED, fontSize: 12.5, marginTop: 2 }}>
          {view.headline}
        </div>
      ) : null}
      {view.steps.length > 0 ? (
        <ol style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
          {view.steps.map((s, i) => {
            const last = i === view.steps.length - 1
            const nameColor = s.state === 'later' ? FAINT : s.state === 'next' ? MUTED : INK
            return (
              <li key={s.number} data-testid={`portal-step-${s.state}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', position: 'relative', paddingBottom: last ? 0 : 14 }}>
                {!last ? <span aria-hidden style={{ position: 'absolute', left: 12.5, top: 26, bottom: 0, width: 1, background: LINE_COLOR }} /> : null}
                <Dot step={s} />
                <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
                  <div style={{ fontWeight: s.state === 'now' ? 700 : 600, fontSize: s.state === 'now' ? 14.5 : 13.5, color: nameColor }}>{s.name}</div>
                  <div style={{ fontSize: 12.5, color: s.state === 'later' ? FAINT : MUTED }}>{s.line}</div>
                  {s.state === 'now' && s.pct != null ? (
                    <div aria-label={`${Math.round(s.pct)} percent along`} style={{ marginTop: 5, height: 5, borderRadius: 3, background: '#e6ecf3', overflow: 'hidden', maxWidth: 260 }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, s.pct))}%`, height: '100%', background: INK }} />
                    </div>
                  ) : null}
                  {s.askable && askSlot ? <div style={{ marginTop: 4 }}>{askSlot(s)}</div> : null}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div style={{ fontSize: 12.5, color: FAINT, marginTop: 8 }}>No stages to show yet.</div>
      )}
      {view.also.length > 0 ? (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px dotted ${HAIR}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Also on this job</div>
          {view.also.map((a) => (
            <div key={a.name} data-testid={`portal-also-${a.state}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '4px 0' }}>
              <span aria-hidden style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ width: 15, height: 15, transform: 'rotate(45deg)', borderRadius: 2, background: a.state === 'done' ? COPPER : PAPER, border: `2px solid ${COPPER}`, boxSizing: 'border-box' }} />
              </span>
              <div style={{ paddingTop: 3 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: a.state === 'later' ? MUTED : INK }}>{a.name}</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>{a.line}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div style={{ fontSize: 11.5, color: FAINT, marginTop: 10 }}>Dates are the plan as it stands; we'll update this page as the work moves.</div>
    </div>
  )
}
