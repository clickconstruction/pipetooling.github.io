import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import { TaskChoiceRows } from './TaskChoiceRows'
import { PASS_TITLE, passAnswers, passCountWords, passSummary, type PassAnswer, type TaskDoerTarget } from '../../lib/tasks/taskDoerActs'

/**
 * Go through the old ones (punch list #369, step C5, tool 4): the Still open list, one task at a time. Each task is
 * answered with a tool that exists, Done, Still on it, Can't do it or No longer applies, or skipped. The pass acts on
 * what is answered and leaves the rest as they were, and ends by saying what it came to.
 */
export function TaskPassSheet({
  open,
  task,
  meta,
  index,
  total,
  sorted,
  busy = false,
  error = null,
  onAnswer,
  onClose,
}: {
  open: boolean
  /** The task being asked about, or null once the pass has run out: the sheet then shows what it came to. */
  task: TaskDoerTarget | null
  /** The task's quiet line: when it was given and how old it is. */
  meta?: string | null
  index: number
  total: number
  /** How many tasks an answer has changed so far. */
  sorted: number
  busy?: boolean
  error?: string | null
  onAnswer: (answer: PassAnswer) => void
  onClose: () => void
}) {
  const isMobile = useIsMobile()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const panel: React.CSSProperties = isMobile
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, borderRadius: '18px 18px 0 0', padding: '14px 16px calc(16px + env(safe-area-inset-bottom, 0px))', maxHeight: '88vh', overflowY: 'auto' }
    : { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: 'min(440px, calc(100vw - 32px))', borderRadius: 16, padding: '16px 18px' }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1205, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby="task-pass-title" onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id="task-pass-title" style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            {PASS_TITLE}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        {task ? (
          <>
            <div data-pass-count style={{ margin: '6px 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{passCountWords(index, total)}</div>
            <div data-pass-task style={{ fontSize: '1.0625rem', fontWeight: 600, lineHeight: 1.3 }}>{task.title}</div>
            {meta ? <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>{meta}</div> : null}
            {error ? (
              <p role="alert" style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-red-700)' }}>
                {error}
              </p>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <TaskChoiceRows choices={passAnswers(task)} onPick={onAnswer} busy={busy} keyAttr="data-pass-answer" />
            </div>
            {sorted > 0 ? (
              <p role="status" style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--text-green-700)' }}>
                {sorted === 1 ? '1 sorted so far.' : `${sorted} sorted so far.`}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p role="status" data-pass-summary style={{ margin: '14px 0 12px', fontSize: '0.9375rem', lineHeight: 1.45, color: 'var(--text-green-700)' }}>
              {passSummary(sorted, total)}
            </p>
            <button type="button" onClick={onClose} style={{ width: '100%', minHeight: 46, borderRadius: 10, border: 'none', font: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer', background: '#2563eb', color: '#fff' }}>
              Back to my list
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
