import { useEffect, useRef, useState, type ReactNode } from 'react'
import { lienGateMark, type LienGate, type LienGateKey, type LienGateVerdict, type LienSentGatesFold } from '../../lib/jobs/lienDeskGates'

/**
 * The gates folded to one line on a sent notice with nothing due (v2.6625, punch list #248): the day it went and the four
 * facts as the paper went, no verdict and no tone — nothing is about to go out. *Details ∨* opens the four as plain rows.
 */
export function LienGatesSentFold({ fold }: { fold: LienSentGatesFold }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="lienGates" data-lien-gates-sent data-open={open ? 'yes' : 'no'}>
      <div className="lienGatesHead" style={{ gap: '0.4rem 0.8rem' }}>
        <span data-lien-gates-sent-line style={{ minWidth: 0, fontSize: '0.8125rem' }}>
          <strong>{fold.head}</strong>
          <span style={{ color: 'var(--text-muted)' }}>{fold.line.slice(fold.head.length)}</span>
        </span>
        <span style={{ flex: 1 }} />
        <button type="button" className="lienGatesFoldBtn" data-lien-gates-sent-fold={open ? 'close' : 'open'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Fold the details ∧' : 'Details ∨'}
        </button>
      </div>
      {open ? (
        <div className="lienGatesGrid" data-count={0}>
          {fold.rows.map((r) => (
            <div key={r.key} className="lienGateDetail" data-tone="ok" data-lien-gates-sent-row={r.key}>
              <span className="lienGateRowNum" aria-hidden="true">{r.n}</span>
              <span className="lienGateRowLabel">{r.label}</span>
              <div className="lienGateRowBody">{r.value}</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The Lien desk's gates as four numbered steps (v2.3657): a verdict headline, then
 * one cell per gate in a fixed slot — one row across a wide pane, stacked 1–4 in a
 * narrow one (a container query on the box, `.lienGates` in index.css, so it follows
 * the pane and not the window). Every gate has a section under the row, numbered to
 * match (v2.3670): a gate that is not clear carries its sentence and its door, a clear
 * one the fact the notice will use.
 *
 * Since v2.4718 the sections fold (the owner's ask: *it all blurs together*): the four
 * cells already say every answer, so a clear gate's section stays folded until its cell is
 * pressed or *Details ∨* opens them all; a gate that is not clear opens on its own. An open
 * section is a row — the number, the label as a column, then the fact with its doors at the
 * right on the first line and one muted line under it. A cell press still brings its section
 * up: scrolled into the pane when it is out of view, and ringed for a few seconds.
 */
export default function LienDeskGates({
  gates,
  verdict,
  details,
  active = null,
  activeAt = 0,
  onPick,
  open = [],
  headless = false,
}: {
  gates: LienGate[]
  verdict: LienGateVerdict
  details: Partial<Record<LienGateKey, ReactNode>>
  /** The gate whose section is being brought up right now (the parent clears it after a moment). */
  active?: LienGateKey | null
  /** Bumped on every pick, so picking the same gate twice brings it up twice. */
  activeAt?: number
  onPick?: (key: LienGateKey) => void
  /** Clear gates whose section stays open whatever the fold says — the owner's, while its pane has a Confirm to press. */
  open?: ReadonlyArray<LienGateKey>
  /** The verdict row is drawn by the pane's stacked head instead (v2.4733). */
  headless?: boolean
}) {
  const box = useRef<HTMLDivElement | null>(null)
  // The clear gates a person opened; a gate that is not clear is open whatever this says.
  const [opened, setOpened] = useState<ReadonlySet<LienGateKey>>(() => new Set())
  const isOpen = (g: LienGate) => g.tone !== 'ok' || open.includes(g.key) || opened.has(g.key)
  const foldable = gates.filter((g) => g.tone === 'ok' && !open.includes(g.key) && details[g.key])
  const allOpen = foldable.every((g) => opened.has(g.key))

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

  const pick = (g: LienGate) => {
    if (!opened.has(g.key)) setOpened(new Set([...opened, g.key]))
    onPick?.(g.key)
  }

  return (
    <div ref={box} className="lienGates" data-lien-desk-gates data-ready={verdict.ready ? 'yes' : 'no'}>
      {headless ? null : (
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
      )}
      <div className="lienGatesGrid" data-count={gates.length}>
        {gates.map((g) => {
          const detail = details[g.key]
          const isActive = active === g.key
          const open = isOpen(g) && Boolean(detail)
          return [
            <button
              key={g.key}
              type="button"
              className="lienGate"
              data-n={g.n}
              data-tone={g.tone}
              data-gate={g.key}
              data-active={isActive ? 'yes' : 'no'}
              title={open ? g.title : `${g.title} — press to open its details`}
              aria-controls={detail ? `lien-gate-${g.key}` : undefined}
              aria-expanded={detail ? open : undefined}
              onClick={() => pick(g)}
            >
              <span className="lienGateNum">{g.n}</span>
              <span className="lienGateLabel">{g.label}</span>
              <span className="lienGateValue">
                <span aria-hidden="true">{lienGateMark(g.tone)}</span> {g.value}
              </span>
            </button>,
            open ? (
              <div key={`${g.key}-detail`} id={`lien-gate-${g.key}`} className="lienGateDetail" data-tone={g.tone} data-gate-detail={g.key} data-active={isActive ? 'yes' : 'no'} tabIndex={-1}>
                <span className="lienGateRowNum" aria-hidden="true">{g.n}</span>
                <span className="lienGateRowLabel">{g.label}</span>
                <div className="lienGateRowBody">{detail}</div>
              </div>
            ) : null,
          ]
        })}
      </div>
      {foldable.length ? (
        <div className="lienGatesFold">
          <button type="button" className="lienGatesFoldBtn" data-lien-gates-fold={allOpen ? 'close' : 'open'} onClick={() => setOpened(allOpen ? new Set() : new Set(gates.map((g) => g.key)))}>
            {allOpen ? 'Fold the details ∧' : 'Details ∨'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
