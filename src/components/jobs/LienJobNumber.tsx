import type { CSSProperties } from 'react'
import { splitLienJobLabel } from '../../lib/jobs/lienJobLabel'

/** The blue chip a job number wears on the Lien desk. */
const LIEN_JOB_NUMBER_STYLE: CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, padding: '0 5px', borderRadius: 3, background: 'var(--bg-blue-tint)', color: 'var(--text-blue-800)', whiteSpace: 'nowrap' }

/**
 * A job's number on the Lien desk (v2.4531 the Calendar, v2.4535 the Timeline and the panes).
 * With a door it is a button of its own that opens the job (the Job window: history, bills,
 * Edit) and stops the click there, so the row or heading around it keeps its own click.
 * With none it is the plain chip.
 */
export function LienJobNumber({ number, muted, onOpen, phone, style }: { number: string; muted?: boolean; onOpen?: () => void; phone?: boolean; style?: CSSProperties }) {
  const look: CSSProperties = { ...(muted ? { ...LIEN_JOB_NUMBER_STYLE, background: 'var(--bg-muted)', color: 'var(--text-muted)' } : LIEN_JOB_NUMBER_STYLE), ...style }
  if (!onOpen) return <span style={look}>{number}</span>
  return (
    <button
      type="button"
      className="lienCalJobNo"
      data-testid="lien-cal-job-no"
      title="Open the job: its history, its bills and Edit"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      style={{ border: 'none', font: 'inherit', cursor: 'pointer', flex: 'none', ...look, ...(phone ? { minHeight: 28, padding: '0 8px' } : null) }}
    >
      {number}
    </button>
  )
}

/**
 * A pane's job heading: "663 · Knight Contracting". With a door the number is the button and the
 * name stands beside it; with none it is the one bold line it always was.
 */
export function LienJobHeading({ label, onOpenJob }: { label: string; onOpenJob?: () => void }) {
  if (!onOpenJob) return <strong style={{ fontSize: '1rem' }}>{label}</strong>
  const { number, name } = splitLienJobLabel(label)
  return (
    <span data-testid="lien-job-heading" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
      <LienJobNumber number={number} onOpen={onOpenJob} style={{ fontSize: '0.8125rem', padding: '1px 7px' }} />
      {name ? <strong style={{ fontSize: '1rem' }}>{name}</strong> : null}
    </span>
  )
}
