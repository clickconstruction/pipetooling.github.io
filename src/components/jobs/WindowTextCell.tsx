/**
 * The Window column as text (v2.2963): line 1 is the dates — a link that
 * opens the stage's details (the calendar, once it exists) — with the GC's
 * chip beside them; line 2 is one sentence of context (who set the window, the
 * sub's pick, "passed"). When the GC has asked for other dates, our dates are
 * lightly struck through (they are the ones being replaced), line 2 carries
 * their dates with Accept and Answer…, and line 3 their reason in their words.
 */
import type { CSSProperties, ReactNode } from 'react'
import { stageWindowLabel, type StageWindowSpan } from '../../lib/subs/stageWindow'

export type WindowGcState = 'none' | 'off' | 'offer' | 'shown' | 'asked'

export type WindowTextCellProps = {
  /** Our window (or the order's proposed span). Null = no window yet; render `setWindow` instead. */
  window: StageWindowSpan | null
  passed?: boolean
  windowBy?: 'office' | 'gc' | null
  pick?: StageWindowSpan | null
  pickBy?: 'sub' | 'office' | null
  /** An open GC ask: their dates and their reason. */
  ask?: { span: StageWindowSpan; note: string | null } | null
  gc: { state: WindowGcState; gcName: string | null }
  /** The dates link. */
  onOpenDates?: () => void
  onChange?: () => void
  /** The GC chip: `offer` sends the stage to the GC's portal; `shown` / `asked` open the GC's facts. */
  onOpenGc?: () => void
  onAccept?: () => void
  onAnswer?: () => void
  /** What to draw when there is no window (the board's "Set a window…" control, or "link the job first"). */
  setWindow?: ReactNode
  /** Anything to draw beneath (the details popover). */
  children?: ReactNode
  busy?: boolean
}

const line: CSSProperties = { fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }
const door: CSSProperties = { font: 'inherit', background: 'none', border: 'none', padding: 0, color: 'var(--text-blue-700)', fontWeight: 600, fontSize: '0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }
const smallBtn = (tone: 'ok' | 'warn', disabled: boolean): CSSProperties => ({
  font: 'inherit',
  fontSize: '0.66rem',
  fontWeight: 600,
  padding: '1px 7px',
  borderRadius: 5,
  cursor: disabled ? 'not-allowed' : 'pointer',
  whiteSpace: 'nowrap',
  opacity: disabled ? 0.6 : 1,
  ...(tone === 'ok' ? { background: 'var(--bg-green-tint)', border: '1px solid var(--border-green)', color: 'var(--text-green-700)' } : { background: 'var(--bg-amber-tint)', border: '1px solid var(--border-amber)', color: 'var(--text-amber-800)' }),
})

/** The GC's chip: what the GC sees, as a door. */
export function WindowGcChip({ state, gcName, onOpen, busy = false }: { state: WindowGcState; gcName: string | null; onOpen?: () => void; busy?: boolean }) {
  if (state === 'none') return null
  const name = gcName?.trim() || 'the GC'
  const base: CSSProperties = { font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 7px', borderRadius: 999, fontSize: '0.64rem', fontWeight: 700, letterSpacing: '0.03em', lineHeight: 1.6, whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }
  if (state === 'off') {
    return (
      <span title="Edit Job → GC/Builder → Share stage dates with this GC" style={{ ...base, background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
        GC off
      </span>
    )
  }
  if (state === 'offer') {
    // Stage Plan PR 4: the GC sees a stage when its eye is on — set on Edit Job → Stages, not here.
    return (
      <span title="Not on the GC portal · turn the eye on under Edit Job → Stages" style={{ ...base, background: 'var(--surface)', color: 'var(--text-muted)', border: '1px dashed var(--border-strong)' }}>
        Not shown · set on Edit
      </span>
    )
  }
  const look: CSSProperties =
    state === 'shown'
        ? { background: 'var(--bg-blue-tint)', color: 'var(--text-blue-700)', border: '1px solid var(--border)' }
        : { background: 'var(--bg-amber-tint)', color: 'var(--text-amber-800)', border: '1px solid var(--border-amber)' }
  const label = state === 'shown' ? `On ${name}'s portal` : 'GC asked'
  const title = state === 'shown' ? `${name} sees this stage · the eye on Edit Job → Stages hides it` : `${name} asked for other dates`
  return (
    <button type="button" title={title} disabled={busy} onClick={onOpen} style={{ ...base, ...look, cursor: busy ? 'not-allowed' : 'pointer' }}>
      {label} ›
    </button>
  )
}

export function WindowTextCell({ window: win, passed = false, windowBy, pick, pickBy, ask, gc, onOpenDates, onChange, onOpenGc, onAccept, onAnswer, setWindow, children, busy = false }: WindowTextCellProps) {
  const chip = <WindowGcChip state={gc.state} gcName={gc.gcName} onOpen={onOpenGc} busy={busy} />
  if (!win) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {setWindow}
          {chip}
        </div>
        {children}
      </div>
    )
  }
  const asked = !!ask
  const datesStyle: CSSProperties = {
    font: 'inherit',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: onOpenDates ? 'pointer' : 'default',
    fontWeight: passed || asked ? 600 : 700,
    fontSize: '0.82rem',
    color: passed || asked ? 'var(--text-muted)' : 'var(--text-base)',
    whiteSpace: 'nowrap',
    textDecoration: asked ? 'line-through' : 'underline dotted',
    textDecorationColor: 'var(--text-faint)',
    textDecorationThickness: asked ? 1 : undefined,
    textUnderlineOffset: 3,
  }
  const gcName = gc.gcName?.trim() || 'the GC'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-start', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={onOpenDates} title={asked ? `${gcName} has asked for other dates — these are the ones being replaced` : passed ? 'This window has passed' : 'Open the details'} aria-label={`Window ${stageWindowLabel(win)}${passed ? ', passed' : ''}${asked ? ', the GC asked for other dates' : ''}`} style={datesStyle}>
          {stageWindowLabel(win)}
          {passed ? ' · passed' : ''}
        </button>
        {chip}
      </div>
      {asked && ask ? (
        <>
          <div style={{ ...line, color: 'var(--text-amber-800)', fontWeight: 600 }}>
            <span>{stageWindowLabel(ask.span)} ·</span>
            <button type="button" style={smallBtn('ok', busy)} disabled={busy} onClick={onAccept}>
              Accept
            </button>
            <button type="button" style={smallBtn('warn', busy)} disabled={busy} onClick={onAnswer}>
              Answer…
            </button>
          </div>
          {ask.note ? <div style={{ ...line, fontStyle: 'italic' }}>“{ask.note}”</div> : null}
        </>
      ) : (
        <div style={line}>
          {pick ? (
            <span style={{ color: 'var(--text-green-700)', fontWeight: 600 }}>
              picked {stageWindowLabel(pick)}
              {pickBy === 'office' ? ' by the office' : ''}
            </span>
          ) : null}
          <span>
            {pick ? '· ' : ''}
            {windowBy === 'gc' ? `as ${gcName} asked` : windowBy === 'office' ? 'set by the office' : 'dates on the order'}
          </span>
          {onChange ? (
            <>
              <span>·</span>
              <button type="button" style={door} onClick={onChange}>
                Change
              </button>
            </>
          ) : null}
        </div>
      )}
      {children}
    </div>
  )
}

export default WindowTextCell
