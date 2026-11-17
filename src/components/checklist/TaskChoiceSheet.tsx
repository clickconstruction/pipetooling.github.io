import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TaskChoice } from '../../lib/tasks/taskDoerActs'

/**
 * A short list of choices for a task (punch list #369): a title, the task's own words, and rows that each say what
 * they do. The map's three ways in use it, and so does the card's More. On the finishing sheet's frame, so it docks to
 * the bottom of a phone and centres at a desk.
 */
export function TaskChoiceSheet<K extends string>({
  open,
  title,
  taskTitle,
  choices,
  onPick,
  onClose,
  foot = null,
  labelId = 'task-choice-sheet-title',
}: {
  open: boolean
  title: string
  /** The task this is about, under the title. */
  taskTitle: string
  choices: ReadonlyArray<TaskChoice<K>>
  onPick: (key: K) => void
  onClose: () => void
  /** A quiet line or a refusal under the rows. */
  foot?: ReactNode
  labelId?: string
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
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.45)', zIndex: 1210, paddingTop: 'var(--app-top-chrome, 0px)' }}>
      <div role="dialog" aria-modal="true" aria-labelledby={labelId} onClick={(e) => e.stopPropagation()} style={{ ...panel, background: 'var(--surface)', color: 'var(--text-strong)', boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <h2 id={labelId} style={{ margin: 0, fontSize: '1.125rem', flex: 1 }}>
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: 'none', background: 'transparent', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
            ×
          </button>
        </div>
        <p style={{ margin: '4px 0 12px', fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{taskTitle}</p>
        <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {choices.map((c, i) => (
            <button
              key={c.key}
              type="button"
              data-task-choice={c.key}
              onClick={() => onPick(c.key)}
              style={{ display: 'grid', gap: 1, width: '100%', minHeight: 52, padding: '8px 12px', textAlign: 'left', font: 'inherit', background: 'var(--surface)', color: 'var(--text-strong)', border: 'none', borderTop: i === 0 ? 'none' : '1px solid var(--border)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{c.label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{c.words}</span>
            </button>
          ))}
        </div>
        {foot ? <div style={{ marginTop: 10 }}>{foot}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
