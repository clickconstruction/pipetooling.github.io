import type { ReactNode } from 'react'
import type { ReleaseStep } from '../../lib/jobs/lienReleaseSteps'

/**
 * One numbered step of the Release of Lien window (v2.4314): the dot on the rail (a tick when
 * done, the number in blue for the one to do, an amber "!" for a fix, a grey number while it
 * waits), the line and arrow down to the next step, and the card. A waiting step that is held by
 * a problem in step 1 shows its title only, one held by a later problem is greyed with its buttons
 * off; a folded step is one line. The states come from
 * `lienReleaseSteps`; the styles live in index.css (`.lienStep*`).
 */
export function LienReleaseStepRow({
  step,
  title,
  say,
  last = false,
  nextIsCurrent = false,
  waitLabel,
  summary,
  children,
}: {
  step: ReleaseStep
  /** "Pick the bills" — the number is added here. */
  title: string
  /** The one plain sentence that says what to do. */
  say?: string
  last?: boolean
  /** The step below is the one to do: the line and arrow lead into it in blue. */
  nextIsCurrent?: boolean
  /** The label for an ordinary wait (step 6 before signing: "Opens once he signs"). */
  waitLabel?: string
  /** The one line a folded step shows. */
  summary?: ReactNode
  children?: ReactNode
}) {
  const { n, state, waitsFor, folded } = step
  const titleId = `lien-step-${n}-title`
  const label =
    state === 'done' ? 'Done' : state === 'now' ? 'You are here' : state === 'warn' ? 'Needs you' : waitsFor != null ? `Waits for step ${waitsFor}` : (waitLabel ?? 'Waiting')
  const lineState = state === 'done' ? (nextIsCurrent ? 'next' : 'done') : 'wait'
  // A problem in step 1 (the bills) folds the steps after it to their titles; a problem further down
  // greys them in place and turns their buttons off, so nothing jumps while it is being fixed.
  const titleOnly = state === 'wait' && waitsFor === 1
  const held = state === 'wait' && waitsFor != null && !titleOnly
  return (
    <section className="lienStep" aria-labelledby={titleId} aria-current={state === 'now' || state === 'warn' ? 'step' : undefined} data-testid={`lien-step-${n}`} data-state={state}>
      <div className="lienStep-rail" aria-hidden="true">
        <div className="lienStep-dot" data-state={state}>
          {state === 'done' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : state === 'warn' ? (
            '!'
          ) : (
            n
          )}
        </div>
        {last ? null : (
          <>
            <div className="lienStep-line" data-state={lineState} />
            <svg className="lienStep-arrow" data-state={lineState} width="14" height="9" viewBox="0 0 14 9">
              <path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        )}
      </div>
      <div className="lienStep-body">
        {folded ? (
          <div className="lienStep-card" data-state={state} data-folded="true">
            <h3 className="lienStep-title" id={titleId}>
              {n} · {title}
            </h3>
            <span className="lienStep-summary">{summary}</span>
          </div>
        ) : (
          <div className="lienStep-card" data-state={state}>
            <div className="lienStep-head">
              <h3 className="lienStep-title" id={titleId}>
                {n} · {title}
              </h3>
              <span className="lienStep-label" data-state={state}>
                {label}
              </span>
            </div>
            {titleOnly ? null : held ? (
              <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0, opacity: 0.55, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {say ? <p className="lienStep-say">{say}</p> : null}
                {children}
              </fieldset>
            ) : (
              <>
                {say ? <p className="lienStep-say">{say}</p> : null}
                {children}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
