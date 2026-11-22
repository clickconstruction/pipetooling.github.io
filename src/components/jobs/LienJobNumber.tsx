import type { CSSProperties } from 'react'
import { PHONE_PRESS_MIN_HEIGHT, thumbInLine } from '../../lib/phonePress'

/** The blue chip a job number wears on the Lien desk. */
const LIEN_JOB_NUMBER_STYLE: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0 5px', borderRadius: 3, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }

/** The door's words, on every job door of the desk. */
export const LIEN_JOB_DOOR_TITLE = 'Open the job: its history, its bills and Edit'

/** A job door is text in the row's own size and color that underlines on hover (`.lienJobDoor`, v2.4628); it was a blue chip from v2.4531. */
const LIEN_JOB_DOOR_STYLE: CSSProperties = { border: 'none', background: 'none', padding: 0, margin: 0, font: 'inherit', fontWeight: 700, color: 'inherit', cursor: 'pointer', flex: 'none', textAlign: 'left', borderRadius: 3, whiteSpace: 'nowrap' }

/**
 * The door on a phone's By date row (the phone walk of 2026-11-21 read it at 28 px tall and 29 to 40 wide): a thumb's
 * square, with the margin that leaves the row's first line the 28 px it was. The number stays at the row's left edge.
 */
const LIEN_JOB_DOOR_PHONE: CSSProperties = { ...thumbInLine(28), minWidth: PHONE_PRESS_MIN_HEIGHT }

/**
 * A job's number on the Lien desk (v2.4531 the Calendar, v2.4535 the Timeline and the panes).
 * With a door it is a button of its own that opens the job (the Job window: history, bills,
 * Edit) and stops the click there, so the row or heading around it keeps its own click.
 * Since v2.4628 the door is text that underlines on hover, as the Next up rows' is; with no
 * door the number is the plain chip.
 */
export function LienJobNumber({ number, muted, onOpen, phone, style }: { number: string; muted?: boolean; onOpen?: () => void; phone?: boolean; style?: CSSProperties }) {
  if (!onOpen) {
    const look: CSSProperties = { ...(muted ? { ...LIEN_JOB_NUMBER_STYLE, background: 'var(--bg-muted)', color: 'var(--text-muted)' } : LIEN_JOB_NUMBER_STYLE), ...style }
    return <span style={look}>{number}</span>
  }
  return (
    <button
      type="button"
      className="lienJobDoor"
      data-testid="lien-cal-job-no"
      title={LIEN_JOB_DOOR_TITLE}
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      style={{ ...LIEN_JOB_DOOR_STYLE, ...(muted ? { color: 'var(--text-muted)', fontWeight: 600 } : null), ...(phone ? LIEN_JOB_DOOR_PHONE : null), ...style }}
    >
      {number}
    </button>
  )
}

/**
 * A pane's job heading: "663 · Kestrin Contracting". With a door the whole line is the button
 * (since v2.4628; the number alone was, as a chip, from v2.4535); with none it is the one bold
 * line it always was.
 */
export function LienJobHeading({ label, onOpenJob }: { label: string; onOpenJob?: () => void }) {
  if (!onOpenJob) return <strong style={{ fontSize: '1rem' }}>{label}</strong>
  return (
    <button
      type="button"
      className="lienJobDoor"
      data-testid="lien-job-heading"
      title={LIEN_JOB_DOOR_TITLE}
      onClick={(e) => {
        e.stopPropagation()
        onOpenJob()
      }}
      // The heading is a title, so in a pane narrower than its words it wraps whole (v2.7446); it was one unshrinking line that ran out of the pane.
      style={{ ...LIEN_JOB_DOOR_STYLE, fontSize: '1rem', flex: '0 1 auto', minWidth: 0, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
    >
      {label}
    </button>
  )
}
