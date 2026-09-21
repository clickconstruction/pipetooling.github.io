import { useEffect, useRef, type ReactNode } from 'react'
import { lienGateMark, type LienGate, type LienGateKey, type LienGateVerdict } from '../../lib/jobs/lienDeskGates'

/**
 * The Lien desk's gates as four numbered steps (v2.3657): a verdict headline, then
 * one cell per gate in a fixed slot — one row across a wide pane, stacked 1–4 in a
 * narrow one (a container query on the box, `.lienGates` in index.css, so it follows
 * the pane and not the window). Every gate has a section under the row, numbered to
 * match (v2.3670): a gate that is not clear carries its sentence and its door, a clear
 * one the fact the notice will use. Each cell is a button that brings its section up —
 * scrolled into the pane when it is out of view, and ringed for a few seconds.
 */
export default function LienDeskGates({
  gates,
  verdict,
  details,
  active = null,
  activeAt = 0,
  onPick,
}: {
  gates: LienGate[]
  verdict: LienGateVerdict
  details: Partial<Record<LienGateKey, ReactNode>>
  /** The gate whose section is being brought up right now (the parent clears it after a moment). */
  active?: LienGateKey | null
  /** Bumped on every pick, so picking the same gate twice brings it up twice. */
  activeAt?: number
  onPick?: (key: LienGateKey) => void
}) {
  const box = useRef<HTMLDivElement | null>(null)

  // Bringing a section up: scroll only when it is not already in the pane's view (the pinned strip covers the top 48px), then move focus to it.
  useEffect(() => {
    if (!active || !box.current) return
    const el = box.current.querySelector<HTMLElement>(`[data-gate-detail="${active}"]`)
    if (!el) return
    const pane = el.closest<HTMLElement>('[data-lien-desk-pane]')
    const r = el.getBoundingClientRect()
    const p = pane ? pane.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
    const inView = r.top >= p.top + 48 && r.bottom <= p.bottom
    if (!inView) el.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    el.focus?.({ preventScroll: true })
  }, [active, activeAt])

  return (
    <div ref={box} className="lienGates" data-lien-desk-gates data-ready={verdict.ready ? 'yes' : 'no'}>
      <div className="lienGatesHead">
        <span className="lienGatesVerdict" data-ready={verdict.ready ? 'yes' : 'no'}>
          <span aria-hidden="true">{verdict.ready ? '✓' : '✗'}</span> {verdict.headline}
        </span>
        <span className="lienGatesSummary">{verdict.summary}</span>
        <span className="lienGatesBar" aria-hidden="true">
          {gates.map((g) => (
            <span key={g.key} data-tone={g.tone} />
          ))}
        </span>
      </div>
      <div className="lienGatesGrid">
        {gates.map((g) => {
          const detail = details[g.key]
          const isActive = active === g.key
          return [
            <button
              key={g.key}
              type="button"
              className="lienGate"
              data-n={g.n}
              data-tone={g.tone}
              data-gate={g.key}
              data-active={isActive ? 'yes' : 'no'}
              title={g.title}
              aria-controls={detail ? `lien-gate-${g.key}` : undefined}
              onClick={() => onPick?.(g.key)}
            >
              <span className="lienGateNum">{g.n}</span>
              <span className="lienGateLabel">{g.label}</span>
              <span className="lienGateValue">
                <span aria-hidden="true">{lienGateMark(g.tone)}</span> {g.value}
              </span>
            </button>,
            detail ? (
              <div key={`${g.key}-detail`} id={`lien-gate-${g.key}`} className="lienGateDetail" data-tone={g.tone} data-gate-detail={g.key} data-active={isActive ? 'yes' : 'no'} tabIndex={-1}>
                <span className="lienGateDetailLead">
                  {g.n} · {g.label}
                </span>
                {detail}
              </div>
            ) : null,
          ]
        })}
      </div>
    </div>
  )
}
