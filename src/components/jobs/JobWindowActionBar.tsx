import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import JobStatusStepper, { type JobStatusStepperJob } from './JobStatusStepper'
import { PhoneSheet } from '../PhoneSheet'
import { recordViewerNavClick } from '../../lib/navClickViewer'
import { JOB_WINDOW_BAR_MIN_HEIGHT, type JobWindowBarButton, type JobWindowBarKey, type JobWindowBarTone } from '../../lib/jobs/jobWindowBar'

const btn: CSSProperties = {
  // Narrow sides so four buttons fit a 375 px phone with the verb's words whole (measured in Chromium).
  padding: '0.5rem 0.6rem',
  minHeight: JOB_WINDOW_BAR_MIN_HEIGHT,
  minWidth: 0,
  borderRadius: 10,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 700,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  // A label too long for its cell ellipsizes rather than pushing the next button off the bar.
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  lineHeight: 1.1,
  textAlign: 'center',
}
const tone: Record<JobWindowBarTone, CSSProperties> = {
  outline: {},
  blue: { background: '#2563eb', borderColor: '#2563eb', color: '#fff' },
  green: { background: '#16a34a', borderColor: '#16a34a', color: '#fff' },
  red: { background: '#dc2626', borderColor: '#dc2626', color: '#fff' },
  // Leaving wears the composer chip's amber (v2.1640), so the stamp reads the same on the bar.
  amber: { background: 'var(--bg-amber-100)', borderColor: '#f59e0b', color: 'var(--text-amber-800)' },
}

/**
 * A job window's phone action bar (punch list #30, PR 2b; the crew's window since punch list
 * #189, PR 4): a non-scrolling row under the body drawn from what the kernel returns —
 * `tabbedJobWindowBar` (Status ▾ · the job's next verb · Note) or `crewJobWindowBar` (Arrived or
 * Leaving · Leave report · Note) — so the moves are on screen at any scroll depth. Every button
 * stands `JOB_WINDOW_BAR_MIN_HEIGHT` tall. Draws nothing for an empty row.
 */
export function JobWindowActionBar({
  buttons,
  onPress,
  safeAreaBottom = true,
}: {
  buttons: readonly JobWindowBarButton[]
  onPress: (key: JobWindowBarKey) => void
  /** Pad the bar's foot by the home bar's inset — off inside a card whose overlay already does. */
  safeAreaBottom?: boolean
}) {
  if (buttons.length === 0) return null
  const grows = buttons.some((b) => b.grow)
  return (
    <div
      role="toolbar"
      aria-label="Job actions"
      // v2.5904: each press on the bar writes one `ui_nav_clicks` row, named by the button, as the signed-in viewer.
      data-navtrack="job-window"
      data-navbuttons=""
      onClickCapture={recordViewerNavClick}
      style={{
        display: 'grid',
        gridTemplateColumns: buttons.map((b) => (b.grow ? 'minmax(0, 1fr)' : 'auto')).join(' '),
        ...(grows ? null : { justifyContent: 'space-between' }),
        gap: '0.375rem',
        padding: safeAreaBottom ? '0.5rem 0.6rem calc(0.5rem + env(safe-area-inset-bottom, 0px))' : '0.5rem 0.6rem',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {buttons.map((b) => (
        <button key={b.key} type="button" onClick={() => onPress(b.key)} style={{ ...btn, ...tone[b.tone] }} aria-haspopup={b.opensDialog ? 'dialog' : undefined}>
          {b.label}
        </button>
      ))}
    </div>
  )
}

/** Status ▾: the Edit tab's stepper, rail and guards intact, in a bottom sheet. */
export function JobWindowStatusSheet({ open, job, authRole, onChanged, onClose }: { open: boolean; job: JobStatusStepperJob; authRole: string | null; onChanged: () => void; onClose: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])
  if (!open) return null
  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1020, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Job status"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--surface)', color: 'var(--text)', borderRadius: '14px 14px 0 0', width: '100%', maxWidth: 640, padding: '0.6rem 0.85rem calc(0.85rem + env(safe-area-inset-bottom))', boxShadow: '0 -8px 30px rgba(0,0,0,0.25)', boxSizing: 'border-box' }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 0.5rem' }} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-strong)' }}>Status</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1rem', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Tap the next stage. A move that needs a reason, a bill line or a payment asks for it, as on the Edit tab.</div>
        <JobStatusStepper job={job} authRole={authRole} onChanged={onChanged} />
      </div>
    </div>
  )
}

/**
 * Note (punch list #189, PR 4): the crew's composer as a sheet from the bottom over the keyboard
 * — `PhoneSheet`, whose backdrop is as tall as the room the keyboard leaves, so the box and Save
 * sit on the keyboard's top. The note box is focused on open (in the commit, so a phone raises its
 * keyboard for the same press) with Save beside it at the bar's height. Save posts the note
 * exactly as the composer's Post note does — the same draft, the same thread — and closes the
 * sheet once it lands; a failed post keeps the words and the sheet.
 */
export function JobWindowNoteSheet({
  open,
  draft,
  onDraftChange,
  submitting,
  onSave,
  onClose,
}: {
  open: boolean
  draft: string
  onDraftChange: (v: string) => void
  submitting: boolean
  /** Resolves true once the note is on the thread. */
  onSave: () => Promise<boolean>
  onClose: () => void
}) {
  const boxRef = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const el = boxRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [open])
  if (!open) return null
  const empty = draft.trim().length === 0
  const save = () => {
    if (submitting || empty) return
    void onSave().then((ok) => {
      if (ok) onClose()
    })
  }
  return (
    <PhoneSheet label="Note" title="Note" onClose={onClose}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.5rem', alignItems: 'end', padding: '0.75rem 1rem 1rem' }}>
        <textarea
          ref={boxRef}
          aria-label="Add a note"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          disabled={submitting}
          maxLength={2000}
          rows={3}
          placeholder="Write a note for the crew and the office…"
          style={{
            width: '100%',
            minHeight: JOB_WINDOW_BAR_MIN_HEIGHT,
            padding: '0.6rem 0.7rem',
            // 16 px: iOS zooms the page into a smaller field on focus.
            fontSize: '1rem',
            lineHeight: 1.4,
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            background: 'var(--surface)',
            color: 'var(--text-strong)',
            boxSizing: 'border-box',
            resize: 'none',
            maxHeight: '10rem',
            overflowY: 'auto',
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={submitting || empty}
          style={{
            ...btn,
            ...(submitting || empty ? { background: 'var(--bg-200)', borderColor: 'var(--bg-200)', color: 'var(--text-muted)', cursor: 'not-allowed' } : tone.blue),
          }}
        >
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </PhoneSheet>
  )
}
