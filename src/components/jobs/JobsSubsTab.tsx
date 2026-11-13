/**
 * Jobs → Subs (v2.2927): one tab, two views on the same sub sheets.
 *   Work — by job: stages with windows, work orders, the rail (was Work Orders).
 *   Pay  — by sub: the pay run (was Sub Labor).
 * The segmented control lives here; the views are handed in so the page keeps
 * owning their data. Superintendents see Pay only — no control. Pay's toolbar
 * (New Sub Labor + search) and Work's (+ New work order, search, chips) ride the
 * control's row so the tiles start higher.
 */
import type { ReactNode } from 'react'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'

export type SubsView = 'work' | 'pay' | 'ledger'

export const SUBS_VIEWS: ReadonlyArray<{ key: SubsView; label: string; hint: string }> = [
  { key: 'work', label: 'Work', hint: 'by job · stages, windows, work orders' },
  { key: 'pay', label: 'Pay', hint: "by sub · who's owed" },
  // v2.7174 · every payment by date (punch list #347). Drawn only when the page hands a ledger in.
  { key: 'ledger', label: 'Ledger', hint: 'by date · every payment made' },
]

/** `?view=` → a view; anything else is Work (Pay when Work is hidden: a Pay-only role reads no payments list). */
export function subsViewFromParam(value: string | null | undefined, canSeeWork: boolean): SubsView {
  if (!canSeeWork) return 'pay'
  return value === 'pay' ? 'pay' : value === 'ledger' ? 'ledger' : 'work'
}

export type JobsSubsTabProps = {
  view: SubsView
  onViewChange: (view: SubsView) => void
  canSeeWork: boolean
  work: ReactNode
  pay: ReactNode
  /** The Ledger view (v2.7174). Absent: the control has no Ledger and `?view=ledger` opens Work. */
  ledger?: ReactNode
  /** Rendered to the right of the control while Work is open (+ New work order, the search box, the rail-group chips). */
  workToolbar?: ReactNode
  /** Rendered to the right of the control while Pay is open (the New Sub Labor button and the search box). */
  payToolbar?: ReactNode
}

export function JobsSubsTab({ view, onViewChange, canSeeWork, work, pay, ledger, workToolbar, payToolbar }: JobsSubsTabProps) {
  const narrow = useIsNarrowScreen()
  const hasLedger = ledger !== undefined && ledger !== null
  const active: SubsView = !canSeeWork ? 'pay' : view === 'ledger' && !hasLedger ? 'work' : view
  const views = SUBS_VIEWS.filter((v) => v.key !== 'ledger' || hasLedger)
  const current = SUBS_VIEWS.find((v) => v.key === active)!
  // The Ledger carries its own search and periods under the control.
  const toolbar = active === 'work' ? workToolbar : active === 'pay' ? payToolbar : null
  return (
    <div>
      {canSeeWork || toolbar ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          {canSeeWork ? (
            <div role="tablist" aria-label="Subs view" style={{ display: 'inline-flex', border: '1px solid var(--border-strong)', borderRadius: 8, overflow: 'hidden' }}>
              {views.map((v) => {
                const on = v.key === active
                return (
                  <button
                    key={v.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => onViewChange(v.key)}
                    style={{ padding: '0.4rem 0.95rem', fontSize: '0.8125rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: on ? '#2563eb' : 'var(--surface)', color: on ? 'white' : 'var(--text-700)' }}
                  >
                    {v.label}
                  </button>
                )
              })}
            </div>
          ) : null}
          {toolbar}
          {canSeeWork && !narrow ? <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{current.hint}</span> : null}
        </div>
      ) : null}
      {active === 'work' ? work : active === 'ledger' ? ledger : pay}
    </div>
  )
}

export default JobsSubsTab
