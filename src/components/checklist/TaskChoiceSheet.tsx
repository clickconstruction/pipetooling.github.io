import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { TaskChoice } from '../../lib/tasks/taskDoerActs'
import { TaskChoiceRows } from './TaskChoiceRows'
import { TaskSheetHead } from './TaskSheetHead'

/**
 * A short list of choices for a task (punch list #369): the head every task sheet shares (`TaskSheetHead`) and rows
 * that each show and say what they do (`TaskChoiceRows`, v2.8034). The map's three ways in use it, and so does
 * the card's More. On the finishing sheet's frame, so it docks to the bottom of a phone and centres at a desk.
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
  /** The task this is about, on one line under the title. A long one is cut with an ellipsis. */
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
        <TaskSheetHead title={title} labelId={labelId} taskTitle={taskTitle} onClose={onClose} />
        <TaskChoiceRows choices={choices} onPick={onPick} />
        {foot ? <div style={{ marginTop: 10 }}>{foot}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
