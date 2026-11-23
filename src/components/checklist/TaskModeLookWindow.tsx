import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { useIsNarrowScreen } from '../../hooks/useIsNarrowScreen'
import { LOOK_CANT_TITLE, LOOK_CLOSE_LABEL, LOOK_LINE_LEAD, LOOK_READ_AGAIN_LABEL, lookCantLines, lookLine, lookReadAtWords, lookWindowTitle } from '../../lib/tasks/taskLook'
import { LOOK_BAR_AHEAD, LOOK_BAR_SCREEN } from '../../lib/tasks/comingUp'
import { ModeRowThirds } from '../layout/ModeRow'
import { TaskModeChip } from '../TaskModeChip'
import { TaskLookGate } from './TaskLookGate'

type Props = {
  /** The person whose screen this is, by their whole name. */
  personName: string
  /** When the day inside was read. The window does not move after that. */
  readAt: Date
  onReadAgain: () => void
  onClose: () => void
  /**
   * The top of the person's screen in Task Mode: the mode row with Task Mode filled for a role that has it
   * (`modeRowOfferedToRole`), the green strip for the estimator. Nothing until the person's role is read.
   */
  top?: 'row' | 'strip'
  /** The person's Today, drawn in its look mode by the page that owns it. */
  children: ReactNode
  /** Coming up, for the side column, above the list of what a look does not show. */
  side?: ReactNode
  /** A dev's line to View as the person, under that list. The viewer's own press, so it sits outside the gate. */
  door?: ReactNode
}

const PANEL: CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem 0.9rem' }
const HEAD_PRESS: CSSProperties = { font: 'inherit', fontSize: '0.8125rem', fontWeight: 600, minHeight: 36, padding: '0 0.75rem', border: '1px solid var(--border-strong)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text-strong)', cursor: 'pointer', flexShrink: 0 }

/**
 * See a person's Task Mode (punch list #381): the window Review opens from a person's card. At a desk it draws their
 * screen at a phone's width beside a side column. On a phone it takes the whole screen, and a bar switches between
 * their screen and the side column, so Coming up is one press away and not under a long day. The top of their screen, the mode row or the estimator's Task Mode strip, and the day are drawn inside `TaskLookGate`, so nothing in them can be pressed to change
 * a task. The head's own presses are the viewer's and work.
 */
export function TaskModeLookWindow({ personName, readAt, onReadAgain, onClose, top, children, side, door }: Props) {
  const phone = useIsNarrowScreen()
  const titleId = useId()
  /** On a phone, which of the two is showing. Both stay drawn, so the day keeps its place and what was opened. */
  const [showing, setShowing] = useState<'screen' | 'ahead'>('screen')
  useBodyScrollLock(true)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const screen = (
    <TaskLookGate>
      {top === 'row' ? (
        <div data-look-mode-row style={{ padding: '0.4rem 0.6rem', background: 'var(--chrome-bg)', borderBottom: '1px solid var(--chrome-border)' }}>
          <ModeRowThirds on="task" />
        </div>
      ) : top === 'strip' ? (
        <TaskModeChip onExit={() => {}} />
      ) : null}
      <div style={{ padding: '0.1rem 0.85rem 1rem' }}>{children}</div>
    </TaskLookGate>
  )
  const sideColumn = (
    <div data-look-side style={{ flex: phone ? 'none' : '1 1 240px', minWidth: 0, display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
      {side}
      <section style={PANEL}>
        <h4 style={{ margin: '0 0 0.35rem', fontSize: '0.9375rem' }}>{LOOK_CANT_TITLE}</h4>
        <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: 3, fontSize: '0.8125rem', color: 'var(--text-700)' }}>
          {lookCantLines(personName).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {door}
      </section>
    </div>
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-task-look-window
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 750, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: phone ? 'stretch' : 'center', justifyContent: 'center', padding: phone ? 'var(--app-top-chrome, 0px) 0 0' : 'calc(1rem + var(--app-top-chrome, 0px)) 1rem 1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--surface)', width: '100%', maxWidth: phone ? undefined : 860, maxHeight: '100%', borderRadius: phone ? 0 : 14, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.6rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ minWidth: 0 }}>
            <h3 id={titleId} style={{ margin: 0, fontSize: '1.0625rem' }}>
              {lookWindowTitle(personName)}
            </h3>
            <div data-look-read-at style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {lookReadAtWords(readAt)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
            <button type="button" onClick={onReadAgain} style={HEAD_PRESS} title="Read this person's day again">
              {LOOK_READ_AGAIN_LABEL}
            </button>
            <button type="button" onClick={onClose} style={HEAD_PRESS}>
              {LOOK_CLOSE_LABEL}
            </button>
          </div>
        </div>
        <p role="note" data-look-line style={{ flex: 'none', margin: 0, padding: '0.4rem 1rem', background: 'var(--bg-amber-tint)', borderBottom: '1px solid var(--border-amber)', color: 'var(--text-amber-800)', fontSize: '0.8125rem', lineHeight: 1.4 }}>
          <b>{LOOK_LINE_LEAD}</b> {lookLine(personName)}
        </p>
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', background: 'var(--bg-subtle)', padding: phone ? '0.75rem' : '1rem', display: 'flex', flexDirection: phone ? 'column' : 'row', gap: phone ? '0.75rem' : '1.25rem', alignItems: phone ? 'stretch' : 'flex-start' }}>
          {phone ? (
            <>
              <div role="group" aria-label="What the window shows" data-look-bar style={{ flex: 'none', display: 'flex', border: '1px solid var(--border-strong)', borderRadius: 10, overflow: 'hidden' }}>
                {(
                  [
                    ['screen', LOOK_BAR_SCREEN],
                    ['ahead', LOOK_BAR_AHEAD],
                  ] as const
                ).map(([key, label], i) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={showing === key}
                    onClick={() => setShowing(key)}
                    style={{ flex: 1, minHeight: 40, font: 'inherit', fontSize: '0.8125rem', fontWeight: showing === key ? 700 : 400, border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--border)', background: showing === key ? 'var(--bg-blue-tint)' : 'var(--surface)', color: showing === key ? 'var(--text-blue-800)' : 'var(--text-strong)', cursor: 'pointer' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* On a phone the window's own body scrolls, so the screen keeps its whole height. */}
              <div data-look-screen style={{ flex: 'none', display: showing === 'screen' ? 'block' : 'none', border: '2px solid var(--text-700)', borderRadius: 16, overflow: 'hidden', background: 'var(--bg-page)' }}>
                {screen}
              </div>
            </>
          ) : (
            // At a desk the screen is a phone: its own width, its own scroll, a thick edge.
            <div data-look-screen style={{ flex: 'none', width: 390, maxWidth: '100%', border: '6px solid var(--text-700)', borderRadius: 30, overflow: 'hidden', background: 'var(--bg-page)' }}>
              <div style={{ maxHeight: 'min(720px, calc(100vh - 15rem))', overflowY: 'auto' }}>{screen}</div>
            </div>
          )}
          {phone && showing !== 'ahead' ? null : sideColumn}
        </div>
      </div>
    </div>
  )
}
