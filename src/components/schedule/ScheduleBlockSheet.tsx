import type { ReactNode } from 'react'
import { DISPATCH_MODE_FOOTER_HEIGHT_PX } from '../dispatchMode/DispatchModeFooter'

/**
 * The block sheet (v2.3885, punch list #30 PR 4b-2): what a tap on a schedule
 * block opens on a phone. Lifted out of the People tab's phone board so the
 * Day tab opens the same sheet — one sheet, the same verbs in the same order,
 * each drawn only when its handler is passed.
 */

const BOTTOM_INSET = `calc(${DISPATCH_MODE_FOOTER_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`

export function ScheduleSheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1003, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', background: 'var(--surface)', color: 'var(--text-700)', borderRadius: '18px 18px 0 0', padding: `0.6rem 0.8rem calc(1rem + ${BOTTOM_INSET})`, display: 'grid', gap: '0.5rem', boxShadow: '0 -8px 24px rgba(0,0,0,.2)', maxHeight: 'min(85vh, 100%)', overflowY: 'auto' }}
      >
        <div aria-hidden style={{ width: '2.4rem', height: 4, borderRadius: 2, background: 'var(--border-strong)', margin: '0 auto 0.2rem' }} />
        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-strong)' }}>{title}</h3>
        {subtitle ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{subtitle}</div> : null}
        {children}
        <button type="button" onClick={onClose} style={{ fontFamily: 'inherit', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 7, padding: '0.5rem', color: 'var(--text-700)', fontWeight: 600, cursor: 'pointer', marginTop: '0.2rem' }}>
          Close
        </button>
      </div>
    </div>
  )
}

export function ScheduleSheetAction({ label, hint, onClick, primary, danger }: { label: string; hint?: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        fontFamily: 'inherit',
        border: `1px solid ${danger ? 'var(--border-red)' : primary ? '#3b82f6' : 'var(--border)'}`,
        background: primary ? 'var(--bg-blue-tint)' : 'var(--surface)',
        borderRadius: 9,
        padding: '0.6rem 0.7rem',
        display: 'grid',
        gap: '0.1rem',
        cursor: 'pointer',
        color: danger ? 'var(--text-red-700)' : 'var(--text-strong)',
      }}
    >
      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{label}</span>
      {hint ? <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span> : null}
    </button>
  )
}

export type ScheduleBlockSheetProps = {
  /** The job's title — `J473 · Mike Holub`. */
  title: string
  /** `7a–9a · Malachi · 109 Tuscarora Trail` */
  subtitle: string
  /** The block's note, '' when none — the note row reads *Edit the note* with it, *Add a note* without. */
  note: string
  onClose: () => void
  onOpenJob: () => void
  onEditNote?: () => void
  onCopyToTechs?: () => void
  onMove?: () => void
  /** The Day tab's move is the sheet with day chips and a person pick; the People tab's is tap-to-place. */
  moveLabel?: string
  moveHint?: string
  onRemove?: () => void
}

export function ScheduleBlockSheet(props: ScheduleBlockSheetProps) {
  const { title, subtitle, note, onClose, onOpenJob, onEditNote, onCopyToTechs, onMove, moveLabel = 'Move', moveHint = 'Then tap the tech and day it goes to', onRemove } = props
  return (
    <ScheduleSheet onClose={onClose} title={title} subtitle={subtitle}>
      <ScheduleSheetAction label="Open the job" hint="Job detail with this visit's times" onClick={onOpenJob} />
      {onEditNote ? <ScheduleSheetAction label={note ? 'Edit the note' : 'Add a note'} hint={note ? note : 'What the tech needs to know'} onClick={onEditNote} /> : null}
      {onCopyToTechs ? <ScheduleSheetAction label="Copy to techs" hint="Pick the people; linked by default" onClick={onCopyToTechs} primary /> : null}
      {onMove ? <ScheduleSheetAction label={moveLabel} hint={moveHint} onClick={onMove} /> : null}
      {onRemove ? <ScheduleSheetAction label="Remove from the schedule" hint="Only this block; crew-mates keep theirs" danger onClick={onRemove} /> : null}
    </ScheduleSheet>
  )
}
